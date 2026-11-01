import { describe, expect, it } from "vitest";
import type { CardState, GradeRecord, SrsStore } from "@/application/ports/flashcards";
import type { ItemView } from "@/application/ports/study";
import { FlashcardError, makeFlashcards } from "./flashcards";

const NOW = new Date("2026-11-01T09:00:00Z");
const item = (status: ItemView["status"] = "approved") =>
  ({ id: "i1", type: "term", title: "T", question: "Q?", answer: "A", status, excerpts: [] }) as unknown as ItemView;

function setup(card: CardState | null, itemStatus: ItemView["status"] = "approved") {
  const recorded: GradeRecord[] = [];
  const store: SrsStore = {
    nextCard: async () => card,
    cardState: async () => card,
    counts: async () => ({ due: 0, new: 1, reviewedSince: 0, nextDueAt: null }),
    record: async (review) => {
      recorded.push(review);
      return true;
    },
  };
  const flashcards = makeFlashcards({ store, items: { getItem: async () => item(itemStatus) }, now: () => NOW });
  return { flashcards, recorded };
}

const learned: CardState = {
  itemId: "i1",
  state: { easeFactor: 2.5, intervalDays: 6, repetitions: 2, lapses: 0, dueAt: NOW },
  lastReviewedAt: new Date("2026-10-26T09:00:00Z"),
};

describe("flashcards", () => {
  it("shows the wait each grade would give and identifies the showing", async () => {
    const { card } = await setup(learned).flashcards.next({ scope: "all" });
    expect(card).toMatchObject({
      isNew: false,
      version: "2026-10-26T09:00:00.000Z",
      waits: { again: "10m", hard: "14d", good: "15d", easy: "16d" },
    });
  });

  it("hides a card whose item is no longer approved", async () => {
    expect((await setup(learned, "discarded").flashcards.next({ scope: "all" })).card).toBeNull();
  });

  it("records the SM-2 result for the showing it was given", async () => {
    const { flashcards, recorded } = setup(learned);
    expect(await flashcards.grade({ itemId: "i1", grade: "good", version: "2026-10-26T09:00:00.000Z", sessionId: "s1" })).toEqual({
      recorded: true,
    });
    expect(recorded).toEqual([
      {
        itemId: "i1",
        expectedLastReviewedAt: learned.lastReviewedAt,
        grade: "good",
        reviewedAt: NOW,
        sessionId: "s1",
        next: expect.objectContaining({ repetitions: 3, intervalDays: 15 }),
      },
    ]);
  });

  it("ignores a stale showing without writing, and refuses items outside the library", async () => {
    const { flashcards, recorded } = setup(learned);
    expect(await flashcards.grade({ itemId: "i1", grade: "good", version: null })).toEqual({ recorded: false });
    expect(recorded).toEqual([]);
    await expect(setup(null).flashcards.grade({ itemId: "i1", grade: "good", version: null })).rejects.toThrow(FlashcardError);
  });
});
