import { beforeEach, describe, expect, it } from "vitest";
import type { LibraryItem } from "@/application/ports/library";
import type { VerifiedItem } from "@/application/ports/study";
import { InMemoryStudyDb } from "@/test/study-fakes";
import { CONTEXT_CHARS, makeConceptPages, RELATED_LIMIT } from "./concept-page";

const TEXT_A = `${"lead ".repeat(100)}Queues run work items in order.${" tail".repeat(100)}`;
const TEXT_B = "Locks protect shared state from data races.";

let db: InMemoryStudyDb;
let relatedCalls: { id: string; limit: number }[];
const relatedItem = { id: "other", title: "Other" } as LibraryItem;

function pages() {
  return makeConceptPages({
    items: db,
    sources: db,
    library: {
      async related(item, limit) {
        relatedCalls.push({ id: item.id, limit });
        return [relatedItem];
      },
    },
  });
}

function verified(sourceId: string, text: string, excerpt: string, fields: Partial<VerifiedItem> = {}): VerifiedItem {
  const start = text.indexOf(excerpt);
  return {
    type: "concept",
    title: "T",
    summary: "S",
    question: "Q?",
    answer: "A",
    tags: [],
    excerpt: { sourceId, text: excerpt, start, end: start + excerpt.length },
    ...fields,
  };
}

async function addSource(title: string, text: string, ...items: ((sourceId: string) => VerifiedItem)[]) {
  const source = await db.create({ title, attribution: null, fileName: `${title}.md`, mimeType: "text/markdown", text, wordCount: 1 }, [
    { ordinal: 0, heading: null, start: 0, end: text.length, wordCount: 1 },
  ]);
  const chunk = db.chunks.find((c) => c.sourceId === source.id)!;
  await db.saveChunkResult(
    chunk,
    items.map((make) => make(source.id)),
    [],
  );
  return source;
}

beforeEach(() => {
  db = new InMemoryStudyDb();
  relatedCalls = [];
});

describe("concept pages", () => {
  it("shows an approved item with each excerpt in the context of its own document", async () => {
    await addSource("a", TEXT_A, (id) => verified(id, TEXT_A, "Queues run work items in order."));
    await addSource("b", TEXT_B, (id) => verified(id, TEXT_B, "Locks protect shared state"));
    const merged = await db.merge(
      db.items.map((i) => i.id),
      (parts) => ({ ...parts[0]!, tags: [] }),
    );
    await db.setStatus([merged], "approved", "approve");

    const page = await pages().get(merged);
    expect(page!.excerpts.map((e) => [e.sourceTitle, e.context.match])).toEqual([
      ["a", "Queues run work items in order."],
      ["b", "Locks protect shared state"],
    ]);
    const [a, b] = page!.excerpts;
    expect(a!.context).toMatchObject({ truncatedBefore: true, truncatedAfter: true });
    expect(a!.context.before.length).toBeLessThanOrEqual(CONTEXT_CHARS);
    expect(b!.context).toMatchObject({ before: "", after: " from data races.", truncatedBefore: false });
    expect(page!.related).toEqual([relatedItem]);
    expect(relatedCalls).toEqual([{ id: merged, limit: RELATED_LIMIT }]);
  });

  it("returns null for missing items and for items that are not approved", async () => {
    await addSource("a", TEXT_B, (id) => verified(id, TEXT_B, "Locks protect"));
    const [item] = db.items;
    expect(await pages().get("missing")).toBeNull();
    expect(await pages().get(item!.id)).toBeNull();
    await db.setStatus([item!.id], "discarded", "discard");
    expect(await pages().get(item!.id)).toBeNull();
  });

  it("reads a listed answer as steps for how-tos and processes only", async () => {
    const answer = "1. Create a lock.\n2. Lock it around the shared state.";
    await addSource(
      "a",
      TEXT_B,
      (id) => verified(id, TEXT_B, "Locks protect", { type: "how_to", answer }),
      (id) => verified(id, TEXT_B, "shared state", { type: "process", answer: "Just prose." }),
      (id) => verified(id, TEXT_B, "data races", { type: "concept", answer }),
    );
    await db.setStatus(
      db.items.map((i) => i.id),
      "approved",
      "approve",
    );
    const [howTo, process, concept] = await Promise.all(db.items.map((i) => pages().get(i.id)));
    expect(howTo!.steps).toEqual(["Create a lock.", "Lock it around the shared state."]);
    expect(process!.steps).toBeNull();
    expect(concept!.steps).toBeNull();
  });
});
