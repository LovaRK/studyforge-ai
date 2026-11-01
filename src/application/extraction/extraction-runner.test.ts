import { describe, expect, it } from "vitest";
import { LlmRateLimitError, LlmResponseError } from "@/application/ports/llm";
import { createLogger } from "@/infrastructure/logging/logger";
import { MockLlmProvider, type MockResponder } from "@/infrastructure/llm/mock-provider";
import { InMemoryStudyDb } from "@/test/study-fakes";
import { ExtractionRunner, type ExtractionRunnerOptions } from "./extraction-runner";
import { sourceTextFromPrompt } from "./prompt";

const TEXT = [
  "Q: What is ARC?",
  "Automatic Reference Counting frees an object when no strong references remain.",
  "Q: What is a retain cycle?",
  "A retain cycle happens when two objects hold strong references to each other.",
].join("\n");

/** Quotes the first answer sentence of each chunk, plus one invented excerpt. */
const responder: MockResponder = ({ prompt }) => {
  const sentence = sourceTextFromPrompt(prompt).split("\n")[1]!;
  return {
    items: [
      { type: "concept", title: sentence.slice(0, 20), summary: "s", question: "q", answer: "a", excerpt: sentence, tags: ["Memory"] },
      { type: "term", title: "Invented", summary: "s", question: "q", answer: "a", excerpt: "Swift uses garbage collection.", tags: [] },
    ],
  };
};

async function setup(llmResponder: MockResponder = responder, options: Partial<ExtractionRunnerOptions> = {}) {
  const db = new InMemoryStudyDb();
  // Two chunks: one per question.
  const source = await db.create(
    { title: "Notes", attribution: null, fileName: "n.txt", mimeType: "text/plain", text: TEXT, wordCount: 30 },
    [
      { ordinal: 0, heading: null, start: 0, end: TEXT.indexOf("Q: What is a retain"), wordCount: 15 },
      { ordinal: 1, heading: null, start: TEXT.indexOf("Q: What is a retain"), end: TEXT.length, wordCount: 15 },
    ],
  );
  const llm = new MockLlmProvider(llmResponder);
  const sleeps: number[] = [];
  let clock = 0;
  const runner = new ExtractionRunner({
    sources: db,
    store: db,
    cache: db,
    llm,
    model: "test-model",
    logger: createLogger({}, () => {}),
    options: { requestsPerMinute: 0, ...options },
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  });
  const run = async () => {
    runner.start(source.id);
    await runner.whenIdle(source.id);
  };
  return { db, source, llm, runner, sleeps, run };
}

describe("ExtractionRunner", () => {
  it("queues verified items and rejects invented excerpts", async () => {
    const { db, source, run } = await setup();
    await run();

    expect(db.items.map((i) => i.title)).toHaveLength(2);
    expect(db.items[0]!.excerpts[0]!.text).toBe("Automatic Reference Counting frees an object when no strong references remain.");
    expect(db.items[0]!.tags).toEqual(["memory"]);
    expect(db.rejected.map((r) => r.reason)).toEqual(["excerpt_not_found", "excerpt_not_found"]);
    expect(await db.progress(source.id)).toMatchObject({ totalChunks: 2, doneChunks: 2, pendingItems: 2, rejectedItems: 2 });
  });

  it("stores excerpt offsets relative to the whole source", async () => {
    const { db, source, run } = await setup();
    await run();
    const excerpt = db.items[1]!.excerpts[0]!;
    expect(source.text.slice(excerpt.start, excerpt.end)).toBe(excerpt.text);
  });

  it("reuses cached responses instead of calling the model again", async () => {
    const { db, llm, run } = await setup();
    await run();
    expect(llm.calls).toHaveLength(2);

    for (const chunk of db.chunks) chunk.status = "pending";
    await run();
    expect(llm.calls).toHaveLength(2);
  });

  it("backs off exponentially on rate limits, honouring the server's delay", async () => {
    let calls = 0;
    const flaky: MockResponder = (request) => (++calls <= 2 ? new LlmRateLimitError(calls === 1 ? undefined : 9_000) : responder(request));
    const { db, sleeps, run } = await setup(flaky, { baseBackoffMs: 1_000 });
    await run();

    expect(sleeps).toEqual([1_000, 9_000]);
    expect(db.chunks.every((c) => c.status === "done")).toBe(true);
  });

  it("stops when the quota stays exhausted and resumes later from where it stopped", async () => {
    let limited = true;
    const { db, source, llm, run } = await setup((request) => (limited ? new LlmRateLimitError(undefined) : responder(request)), {
      maxAttempts: 2,
    });
    await run();
    expect(db.chunks.map((c) => c.status)).toEqual(["failed", "pending"]);
    expect(llm.calls).toHaveLength(2);

    limited = false;
    await run();
    expect((await db.progress(source.id)).doneChunks).toBe(2);
  });

  it("marks a chunk failed on bad model output and carries on with the next", async () => {
    let calls = 0;
    const { db, run } = await setup((request) => (++calls <= 2 ? new LlmResponseError("not JSON") : responder(request)), {
      maxAttempts: 2,
    });
    await run();
    expect(db.chunks.map((c) => c.status)).toEqual(["failed", "done"]);
    expect(db.chunks[0]!.lastError).toBe("not JSON");
  });

  it("spaces calls to respect the requests-per-minute limit", async () => {
    const { sleeps, run } = await setup(responder, { requestsPerMinute: 6 });
    await run();
    expect(sleeps).toEqual([10_000]);
  });

  it("spaces calls globally when several sources extract at once (#4)", async () => {
    const db = new InMemoryStudyDb();
    const ids: string[] = [];
    for (const n of [1, 2, 3]) {
      const text = `Q: Topic ${n}?\nSentence number ${n} explains a distinct topic in enough words.`;
      const source = await db.create(
        { title: `S${n}`, attribution: null, fileName: "n.txt", mimeType: "text/plain", text, wordCount: 12 },
        [{ ordinal: 0, heading: null, start: 0, end: text.length, wordCount: 12 }],
      );
      ids.push(source.id);
    }
    // Frozen clock: every call asks for its slot at t=0, so the waits show the reserved slots.
    const waits: number[] = [];
    const runner = new ExtractionRunner({
      sources: db,
      store: db,
      cache: db,
      llm: new MockLlmProvider(responder),
      model: "test-model",
      logger: createLogger({}, () => {}),
      options: { requestsPerMinute: 600 },
      sleep: async (ms) => void waits.push(ms),
      now: () => 0,
    });

    for (const id of ids) runner.start(id);
    await Promise.all(ids.map((id) => runner.whenIdle(id)));

    expect(waits.sort((a, b) => a - b)).toEqual([100, 200]);
  });

  it("does not start a second run for the same source", async () => {
    const { runner, source } = await setup();
    expect(runner.start(source.id)).toBe(true);
    expect(runner.start(source.id)).toBe(false);
    expect(runner.isRunning(source.id)).toBe(true);
    await runner.whenIdle(source.id);
    expect(runner.isRunning(source.id)).toBe(false);
  });
});
