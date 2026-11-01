import { beforeEach, describe, expect, it } from "vitest";
import type { VerifiedItem } from "@/application/ports/study";
import { InMemoryStudyDb } from "@/test/study-fakes";
import { makeReview, ReviewError } from "./review";

let db: InMemoryStudyDb;
let review: ReturnType<typeof makeReview>;
let ids: string[];

const verified = (n: number): VerifiedItem => ({
  type: "concept",
  title: `Item ${n}`,
  summary: `Summary ${n}`,
  question: `Question ${n}?`,
  answer: `Answer ${n}`,
  tags: [`tag${n}`],
  excerpt: { sourceId: "", text: `excerpt ${n}`, start: n * 10, end: n * 10 + 9 },
});

beforeEach(async () => {
  db = new InMemoryStudyDb();
  review = makeReview(db);
  const source = await db.create(
    { title: "S", attribution: null, fileName: "s.md", mimeType: "text/markdown", text: "x".repeat(100), wordCount: 1 },
    [{ ordinal: 0, heading: null, start: 0, end: 100, wordCount: 1 }],
  );
  await db.saveChunkResult({ ...db.chunks[0]!, sourceId: source.id }, [verified(1), verified(2), verified(3)], []);
  ids = db.items.map((i) => i.id);
});

describe("review", () => {
  it("approves and discards only pending items", async () => {
    expect(await review.approve([ids[0]!])).toEqual([ids[0]]);
    expect(await review.discard([ids[0]!, ids[1]!])).toEqual([ids[1]]);
    expect(db.items.map((i) => i.status)).toEqual(["approved", "discarded", "pending"]);
    expect(db.events.map((e) => e.action)).toEqual(["approve", "discard"]);
  });

  it("edits the generated fields and marks the item as edited", async () => {
    await review.edit(ids[0]!, { type: "term", title: "New", summary: "S", question: "Q?", answer: "A" });
    expect(db.items[0]).toMatchObject({ type: "term", title: "New", edited: true });
  });

  it("normalises tags", async () => {
    await review.tag(ids[0]!, ["Swift UI", "swift-ui", " ARC "]);
    expect(db.items[0]!.tags).toEqual(["swift-ui", "arc"]);
  });

  it("merges items into one that keeps every excerpt", async () => {
    const mergedId = await review.merge([ids[0]!, ids[2]!]);
    const merged = (await db.getItem(mergedId))!;

    expect(merged.excerpts.map((e) => e.text)).toEqual(["excerpt 1", "excerpt 3"]);
    expect(merged).toMatchObject({
      title: "Item 1",
      summary: "Summary 1\n\nSummary 3",
      answer: "Answer 1\n\nAnswer 3",
      tags: ["tag1", "tag3"],
      status: "pending",
    });
    expect(db.items.filter((i) => ids.includes(i.id)).map((i) => i.status)).toEqual(["merged", "pending", "merged"]);
  });

  it("refuses to merge fewer than two items or items already reviewed", async () => {
    await expect(review.merge([ids[0]!, ids[0]!])).rejects.toBeInstanceOf(ReviewError);
    await review.approve([ids[1]!]);
    await expect(review.merge([ids[0]!, ids[1]!])).rejects.toThrow("review queue");
    await expect(review.edit(ids[1]!, { type: "term", title: "x", summary: "x", question: "x", answer: "x" })).rejects.toBeInstanceOf(
      ReviewError,
    );
  });
});
