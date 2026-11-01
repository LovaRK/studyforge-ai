import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ExtractionRunner } from "@/application/extraction/extraction-runner";
import { makeLibrary } from "@/application/library/library";
import type { ItemView } from "@/application/ports/study";
import { makeReview } from "@/application/review/review";
import { importSource } from "@/application/sources/import-source";
import { itemSearch } from "@/infrastructure/db/schema";
import { demoResponder } from "@/infrastructure/llm/demo-responder";
import { MockLlmProvider } from "@/infrastructure/llm/mock-provider";
import { createLogger } from "@/infrastructure/logging/logger";
import { DocumentTextExtractor } from "@/infrastructure/text/document-text-extractor";
import { connect, truncateAll } from "@/test/integration/database";
import { DrizzleExtractionStore, DrizzleLlmCache } from "./drizzle-extraction-store";
import { DrizzleLibraryStore } from "./drizzle-library-store";
import { DrizzleReviewStore } from "./drizzle-review-store";
import { DrizzleSourceStore } from "./drizzle-source-store";
import { indexApprovedItems } from "./item-search-index";

const MEMORY = `# Memory

Automatic Reference Counting frees an instance once nothing holds a strong reference to it.
A weak reference does not keep the instance alive and becomes nil when it is freed.
An unowned reference also skips the retain but must never outlive its target.`;

const QUEUES = `# Queues

Grand Central Dispatch runs work items on queues that the system manages for you.
The main queue is serial, so user interface updates should always be sent to it.`;

const { client, db } = connect();
const sources = new DrizzleSourceStore(db);
const extraction = new DrizzleExtractionStore(db);
const reviewStore = new DrizzleReviewStore(db);
const review = makeReview(reviewStore);
const store = new DrizzleLibraryStore(db);
const library = makeLibrary(store);

/** Imports a note, extracts it with the offline model, and returns its pending items. */
async function ingest(name: string, text: string) {
  const source = await importSource(
    { sources, extractor: new DocumentTextExtractor() },
    { file: { name, mimeType: "text/markdown", bytes: new TextEncoder().encode(text) } },
  );
  const runner = new ExtractionRunner({
    sources,
    store: extraction,
    cache: new DrizzleLlmCache(db),
    llm: new MockLlmProvider(demoResponder),
    model: "mock",
    logger: createLogger({}, () => {}),
    options: { requestsPerMinute: 0 },
  });
  runner.start(source.id);
  await runner.whenIdle(source.id);
  return { source, items: await reviewStore.listQueue({ sourceId: source.id }) };
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);
/** The pending item quoting `words`. Items from one chunk share a timestamp, so queue order is not stable. */
const pick = (items: ItemView[], words: string) => items.find((item) => item.excerpts.some((e) => e.text.includes(words)))!;
const flat = async (filter: Parameters<typeof library.browse>[0]) => (await library.browse(filter)).groups.flatMap((g) => g.items);

beforeEach(() => truncateAll(db));
afterAll(() => client.end());

describe("Postgres library store", () => {
  it("lists approved items only and indexes them in the approval transaction", async () => {
    const { items } = await ingest("memory.md", MEMORY);
    expect(items).toHaveLength(3);
    const [approved, discarded] = items;
    await review.approve([approved!.id]);
    await review.discard([discarded!.id]);

    expect(ids(await flat({}))).toEqual([approved!.id]);
    expect(ids(await db.select({ id: itemSearch.itemId }).from(itemSearch))).toEqual([approved!.id]);
  });

  it("finds an item by a word prefix that appears only in its verbatim excerpt, and marks the match", async () => {
    const { items } = await ingest("memory.md", MEMORY);
    const item = pick(items, "Automatic Reference Counting");
    await review.edit(item.id, { type: "concept", title: "Ownership", summary: "Who keeps objects alive.", question: "Q?", answer: "A." });
    await review.approve([item.id]);

    const [hit] = await flat({ query: "Automat" });
    expect(hit).toMatchObject({ id: item.id, title: "Ownership", excerptCount: 1 });
    expect(hit!.snippet.filter((s) => s.match).map((s) => s.text)).toEqual(["Automatic"]);
    // The snippet is the whole excerpt, character for character: a source fact is never trimmed.
    expect(hit!.snippet.map((s) => s.text).join("")).toBe(item.excerpts[0]!.text);
  });

  it("ranks a title match above a match that is only in the excerpt", async () => {
    const { items } = await ingest("memory.md", MEMORY);
    const inExcerpt = pick(items, "Automatic Reference Counting");
    const inTitle = pick(items, "weak reference");
    await review.edit(inExcerpt.id, { type: "term", title: "Automatic counting", summary: "S.", question: "Q?", answer: "A." });
    await review.edit(inTitle.id, { type: "term", title: "Instance lifetime", summary: "S.", question: "Q?", answer: "A." });
    await review.approve([inExcerpt.id, inTitle.id]);

    // Both excerpts mention "instance"; only one title does. Without a query the order is by title.
    expect(ids(await flat({ query: "instance" }))).toEqual([inTitle.id, inExcerpt.id]);
    expect(ids(await flat({}))).toEqual([inExcerpt.id, inTitle.id]);
  });

  it("requires every word to match and returns nothing, without failing, for stop words or odd input", async () => {
    const { items } = await ingest("queues.md", QUEUES);
    await review.approve(ids(items));

    expect((await flat({ query: "grand dispatch" })).length).toBe(1);
    expect(await flat({ query: "grand nonexistentword" })).toEqual([]);
    expect(await flat({ query: "the" })).toEqual([]);
    expect((await flat({ query: "grand' | !(dispatch" })).length).toBe(1);
  });

  it("filters by type, tag and source, and reports facets of approved items only", async () => {
    const memory = await ingest("memory.md", MEMORY);
    const queues = await ingest("queues.md", QUEUES);
    // The offline model makes the first sentence of each note a concept and the rest terms.
    const arc = pick(memory.items, "Automatic Reference Counting");
    const gcd = pick(queues.items, "Grand Central Dispatch");
    const weak = pick(memory.items, "weak reference");
    await review.tag(arc.id, ["arc"]);
    await review.tag(pick(queues.items, "main queue").id, ["threads"]);
    await review.approve([arc.id, gcd.id, weak.id]);

    expect(ids(await flat({ sourceId: queues.source.id }))).toEqual([gcd.id]);
    expect(ids(await flat({ tag: "arc" }))).toEqual([arc.id]);
    expect(ids(await flat({ type: "term" }))).toEqual([weak.id]);
    expect(ids(await flat({ type: "concept", sourceId: memory.source.id }))).toEqual([arc.id]);
    expect(await flat({ type: "how_to" })).toEqual([]);

    // "threads" belongs to a pending item, so it is not a library facet.
    expect(await library.facets()).toEqual({
      total: 3,
      tags: ["arc", "demo"],
      sources: [
        { id: memory.source.id, title: "memory" },
        { id: queues.source.id, title: "queues" },
      ],
    });
  });

  it("indexes a merged item with the excerpts of every part, across sources", async () => {
    const memory = await ingest("memory.md", MEMORY);
    const queues = await ingest("queues.md", QUEUES);
    const merged = await review.merge([pick(memory.items, "Counting").id, pick(queues.items, "Dispatch").id]);
    await review.approve([merged]);

    const both = await flat({ query: "counting dispatch" });
    expect(both).toMatchObject([{ id: merged, excerptCount: 2 }]);
    expect(both[0]!.snippet.filter((s) => s.match).map((s) => s.text.toLowerCase())).toEqual(["counting", "dispatch"]);
    const parts = [pick(memory.items, "Counting"), pick(queues.items, "Dispatch")].map((i) => i.excerpts[0]!.text);
    expect(both[0]!.snippet.map((s) => s.text).join("")).toBe(parts.join(" … "));
  });

  it("re-indexing picks up changes and ignores items that are not approved", async () => {
    const { items } = await ingest("memory.md", MEMORY);
    const [approved, pending] = items;
    await review.approve([approved!.id]);
    await db.execute(sql`update items set title = 'Zebra crossing' where id = ${approved!.id}`);
    expect(await flat({ query: "zebra" })).toEqual([]);

    await indexApprovedItems(db, [approved!.id, pending!.id]);
    expect(ids(await flat({ query: "zebra" }))).toEqual([approved!.id]);
    expect(await db.select().from(itemSearch).where(eq(itemSearch.itemId, pending!.id))).toEqual([]);
  });

  it("relates approved items by shared tags first, then by source, never including the item itself", async () => {
    const memory = await ingest("memory.md", MEMORY);
    const queues = await ingest("queues.md", QUEUES);
    const arc = pick(memory.items, "Automatic Reference Counting");
    const weak = pick(memory.items, "weak reference");
    const unowned = pick(memory.items, "unowned reference");
    const gcd = pick(queues.items, "Grand Central Dispatch");
    const main = pick(queues.items, "main queue");
    await review.tag(arc.id, ["memory", "references"]);
    await review.tag(gcd.id, ["memory", "references"]);
    await review.tag(weak.id, ["unrelated"]);
    await review.tag(unowned.id, ["unrelated"]);
    await review.tag(main.id, ["unrelated"]);
    await review.approve([arc.id, weak.id, gcd.id, main.id]);

    // gcd shares two tags; weak only shares the source. unowned is still pending, main shares nothing.
    const related = await store.related({ id: arc.id, tags: ["memory", "references"], sourceId: memory.source.id }, 6);
    expect(ids(related)).toEqual([gcd.id, weak.id]);
    expect(ids(await store.related({ id: arc.id, tags: ["memory", "references"], sourceId: memory.source.id }, 1))).toEqual([gcd.id]);
    expect(ids(await store.related({ id: weak.id, tags: [], sourceId: memory.source.id }, 6))).toEqual([arc.id]);
  });
});
