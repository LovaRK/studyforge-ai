import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ExtractionRunner } from "@/application/extraction/extraction-runner";
import { makeReview } from "@/application/review/review";
import { importSource } from "@/application/sources/import-source";
import { reviewEvents } from "@/infrastructure/db/schema";
import { demoResponder } from "@/infrastructure/llm/demo-responder";
import { MockLlmProvider } from "@/infrastructure/llm/mock-provider";
import { createLogger } from "@/infrastructure/logging/logger";
import { DocumentTextExtractor } from "@/infrastructure/text/document-text-extractor";
import { connect, truncateAll } from "@/test/integration/database";
import { DrizzleExtractionStore, DrizzleLlmCache } from "./drizzle-extraction-store";
import { DrizzleReviewStore } from "./drizzle-review-store";
import { DrizzleSourceStore } from "./drizzle-source-store";

const NOTE = `# Value and reference types

Structs and enums in Swift are value types, so each variable keeps its own copy of the data.
Classes are reference types, so two variables can point at the same instance in memory.

## When to choose a class

Choose a class when you need identity or inheritance from a superclass.
Reach for a struct first when you are modelling plain data without shared state.`;

const { client, db } = connect();
const sources = new DrizzleSourceStore(db);
const extraction = new DrizzleExtractionStore(db);
const cache = new DrizzleLlmCache(db);
const reviewStore = new DrizzleReviewStore(db);
const review = makeReview(reviewStore);

function runner(llm: MockLlmProvider) {
  return new ExtractionRunner({
    sources,
    store: extraction,
    cache,
    llm,
    model: "mock",
    logger: createLogger({}, () => {}),
    options: { requestsPerMinute: 0 },
  });
}

async function importNote(maxWordsPerChunk = 40) {
  return importSource(
    { sources, extractor: new DocumentTextExtractor(), maxWordsPerChunk },
    { file: { name: "types.md", mimeType: "text/markdown", bytes: new TextEncoder().encode(NOTE) }, attribution: "Written for the tests" },
  );
}

async function extract(sourceId: string, llm = new MockLlmProvider(demoResponder)) {
  const r = runner(llm);
  r.start(sourceId);
  await r.whenIdle(sourceId);
  return llm;
}

beforeEach(() => truncateAll(db));
afterAll(() => client.end());

describe("Postgres stores: upload → extraction → review", () => {
  it("persists a source with chunks and reports extraction progress", async () => {
    const source = await importNote();
    expect(await sources.findById(source.id)).toMatchObject({ title: "types", attribution: "Written for the tests", text: NOTE });

    const before = await sources.progress(source.id);
    expect(before.totalChunks).toBe(2);
    expect(before.doneChunks).toBe(0);

    await extract(source.id);
    const after = await sources.progress(source.id);
    expect(after).toMatchObject({ totalChunks: 2, doneChunks: 2, failedChunks: 0, rejectedItems: 2 });
    expect(after.pendingItems).toBeGreaterThan(0);
    expect((await extraction.listRejected(source.id)).every((r) => r.reason === "excerpt_not_found")).toBe(true);
  });

  it("stores excerpts that are exact slices of the source text", async () => {
    const source = await importNote();
    await extract(source.id);
    for (const item of await reviewStore.listQueue({})) {
      for (const excerpt of item.excerpts) expect(source.text.slice(excerpt.start, excerpt.end)).toBe(excerpt.text);
    }
  });

  it("caches model responses in the database across runner instances", async () => {
    const source = await importNote();
    const first = await extract(source.id);
    expect(first.calls).toHaveLength(2);

    const other = await importNote(); // Same text, so the same chunk hashes.
    const second = await extract(other.id);
    expect(second.calls).toHaveLength(0);
    expect((await sources.progress(other.id)).doneChunks).toBe(2);
  });

  it("filters the queue by type, tag and source", async () => {
    const a = await importNote();
    const b = await importNote(1000);
    await extract(a.id);
    await extract(b.id);

    const all = await reviewStore.listQueue({});
    expect((await reviewStore.listQueue({ sourceId: b.id })).every((i) => i.sourceId === b.id)).toBe(true);
    expect((await reviewStore.listQueue({ type: "term" })).every((i) => i.type === "term")).toBe(true);

    await review.tag(all[0]!.id, ["swift", "memory"]);
    expect((await reviewStore.listQueue({ tag: "memory" })).map((i) => i.id)).toEqual([all[0]!.id]);
    expect(await reviewStore.queueTags()).toEqual(expect.arrayContaining(["demo", "memory", "swift"]));
  });

  it("approves, discards, edits and merges, recording every decision", async () => {
    const source = await importNote(1000);
    await extract(source.id);
    const [first, second, third, fourth] = await reviewStore.listQueue({});

    await review.approve([first!.id]);
    await review.discard([second!.id]);
    await review.edit(third!.id, { type: "process", title: "Edited", summary: "S", question: "Q?", answer: "A" });
    expect(await reviewStore.getItem(third!.id)).toMatchObject({ title: "Edited", type: "process", edited: true });

    const mergedId = await review.merge([third!.id, fourth!.id]);
    const merged = (await reviewStore.getItem(mergedId))!;
    expect(merged.excerpts.map((e) => e.text)).toEqual([...third!.excerpts, ...fourth!.excerpts].map((e) => e.text));
    expect((await reviewStore.getItem(third!.id))!.status).toBe("merged");

    const queueIds = (await reviewStore.listQueue({})).map((i) => i.id);
    expect(queueIds).toContain(mergedId);
    expect(queueIds).not.toContain(first!.id);
    expect(await sources.progress(source.id)).toMatchObject({ approvedItems: 1 });

    const actions = (await db.select().from(reviewEvents).where(eq(reviewEvents.itemId, third!.id))).map((e) => e.action);
    expect(actions).toEqual(["edit", "merge"]);
  });

  it("only changes the status of items still pending", async () => {
    const source = await importNote(1000);
    await extract(source.id);
    const [item] = await reviewStore.listQueue({});
    expect(await reviewStore.setStatus([item!.id], "approved", "approve")).toEqual([item!.id]);
    expect(await reviewStore.setStatus([item!.id], "discarded", "discard")).toEqual([]);
  });
});
