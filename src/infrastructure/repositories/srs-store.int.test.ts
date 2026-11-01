import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FlashcardError, makeFlashcards } from "@/application/flashcards/flashcards";
import type { StudyScope } from "@/application/ports/flashcards";
import { makeReview } from "@/application/review/review";
import { cardReviews, srsCards } from "@/infrastructure/db/schema";
import { connect, truncateAll } from "@/test/integration/database";
import { makeIngest, MEMORY_NOTE, pick, QUEUES_NOTE } from "@/test/integration/study";
import { DrizzleReviewStore } from "./drizzle-review-store";
import { DrizzleSrsStore } from "./drizzle-srs-store";

const { client, db } = connect();
const reviewStore = new DrizzleReviewStore(db);
const review = makeReview(reviewStore);
const store = new DrizzleSrsStore(db);
const ingest = makeIngest(db);

const DAY = 86_400_000;
let clock = new Date("2026-11-01T09:00:00Z");
const cards = makeFlashcards({ store, items: reviewStore, now: () => clock });
const all: StudyScope = { scope: "all" };

/** Approves every item of both notes and returns them by name. */
async function approvedDeck() {
  const memory = await ingest("memory.md", MEMORY_NOTE);
  const queues = await ingest("queues.md", QUEUES_NOTE);
  const deck = {
    arc: pick(memory.items, "Automatic Reference Counting"),
    weak: pick(memory.items, "weak reference"),
    unowned: pick(memory.items, "unowned reference"),
    gcd: pick(queues.items, "Grand Central Dispatch"),
    main: pick(queues.items, "main queue"),
  };
  await review.tag(deck.gcd.id, ["threads"]);
  await review.approve(Object.values(deck).map((item) => item.id));
  return { ...deck, memory: memory.source, queues: queues.source };
}

async function studyNext(scope = all, exclude: string[] = []) {
  const { card } = await cards.next(scope, exclude);
  return card;
}

beforeEach(async () => {
  await truncateAll(db);
  clock = new Date("2026-11-01T09:00:00Z");
});
afterAll(() => client.end());

describe("flashcards on Postgres", () => {
  it("offers approved items only, as new cards with SM-2 waits, and records a first grade", async () => {
    const memory = await ingest("memory.md", MEMORY_NOTE);
    const approved = pick(memory.items, "weak reference");
    await review.approve([approved.id]);

    const { card, counts } = await cards.next(all);
    expect(card).toMatchObject({
      itemId: approved.id,
      isNew: true,
      version: null,
      waits: { again: "10m", hard: "1d", good: "1d", easy: "1d" },
    });
    expect(card!.excerpts[0]!.text).toContain("weak reference");
    expect(counts).toEqual({ due: 0, new: 1, reviewedSince: 0, nextDueAt: null });

    expect(await cards.grade({ itemId: approved.id, grade: "good", version: null })).toEqual({ recorded: true });
    const [row] = await db.select().from(srsCards).where(eq(srsCards.itemId, approved.id));
    expect(row).toMatchObject({ repetitions: 1, intervalDays: 1, easeFactor: 2.5, lastReviewedAt: clock });
    expect(row!.dueAt.getTime()).toBe(clock.getTime() + DAY);

    const after = await cards.next(all);
    expect(after.card).toBeNull();
    expect(after.counts).toEqual({ due: 0, new: 0, reviewedSince: 1, nextDueAt: new Date(clock.getTime() + DAY) });
  });

  it("shows due cards before new ones, earliest due first, and skips excluded ids", async () => {
    const deck = await approvedDeck();
    await cards.grade({ itemId: deck.weak.id, grade: "good", version: null }); // due in 1 day
    await cards.grade({ itemId: deck.arc.id, grade: "again", version: null }); // due in 10 minutes

    clock = new Date(clock.getTime() + 2 * DAY);
    // arc has been due since 09:10 on day one, weak since 09:00 on day two.
    const first = await studyNext();
    expect(first).toMatchObject({ itemId: deck.arc.id, isNew: false });
    expect((await studyNext(all, [deck.arc.id]))!.itemId).toBe(deck.weak.id);
    const third = await studyNext(all, [deck.weak.id, deck.arc.id]);
    expect(third!.isNew).toBe(true);
    expect((await cards.next(all)).counts).toMatchObject({ due: 2, new: 3 });
  });

  it("brings an Again card back after ten minutes, not before", async () => {
    const deck = await approvedDeck();
    await cards.grade({ itemId: deck.arc.id, grade: "again", version: null });
    const others = [deck.weak, deck.unowned, deck.gcd, deck.main].map((item) => item.id);

    expect(await studyNext(all, others)).toBeNull();
    clock = new Date(clock.getTime() + 10 * 60_000);
    expect(await studyNext(all, others)).toMatchObject({ itemId: deck.arc.id, waits: { again: "10m", good: "1d" } });
  });

  it("limits cards and counts to a tag or a source", async () => {
    const deck = await approvedDeck();
    expect(await studyNext({ scope: "tag", value: "threads" })).toMatchObject({ itemId: deck.gcd.id });
    expect((await cards.next({ scope: "tag", value: "threads" })).counts.new).toBe(1);
    expect((await cards.next({ scope: "source", value: deck.queues.id })).counts.new).toBe(2);
    expect(await studyNext({ scope: "tag", value: "nothing-here" })).toBeNull();
  });

  it("ignores a second grade of the same showing, even when both arrive together", async () => {
    const deck = await approvedDeck();
    // New card: two first grades race to create it.
    const firsts = await Promise.all([
      cards.grade({ itemId: deck.arc.id, grade: "good", version: null }),
      cards.grade({ itemId: deck.arc.id, grade: "easy", version: null }),
    ]);
    expect(firsts.filter((r) => r.recorded)).toHaveLength(1);

    // Learned card: two grades of the same showing.
    clock = new Date(clock.getTime() + 2 * DAY);
    const shown = (await studyNext())!;
    expect(shown.itemId).toBe(deck.arc.id);
    const seconds = await Promise.all([
      cards.grade({ itemId: deck.arc.id, grade: "good", version: shown.version }),
      cards.grade({ itemId: deck.arc.id, grade: "good", version: shown.version }),
    ]);
    expect(seconds.filter((r) => r.recorded)).toHaveLength(1);
    // A stale showing graded later is ignored too.
    expect(await cards.grade({ itemId: deck.arc.id, grade: "again", version: shown.version })).toEqual({ recorded: false });

    const reviews = await db.select().from(cardReviews).where(eq(cardReviews.itemId, deck.arc.id));
    expect(reviews).toHaveLength(2);
    expect((await db.select().from(srsCards).where(eq(srsCards.itemId, deck.arc.id)))[0]!.repetitions).toBe(2);
  });

  it("refuses to grade items that are not approved", async () => {
    const memory = await ingest("memory.md", MEMORY_NOTE);
    const pending = pick(memory.items, "weak reference");
    await expect(cards.grade({ itemId: pending.id, grade: "good", version: null })).rejects.toThrow(FlashcardError);
    expect(await studyNext()).toBeNull();
    expect(await db.select().from(srsCards)).toEqual([]);
  });
});
