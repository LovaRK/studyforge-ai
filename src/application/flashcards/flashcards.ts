import type { CardState, FlashcardCounts, SrsStore, StudyScope } from "@/application/ports/flashcards";
import type { ExcerptView, ReviewStore } from "@/application/ports/study";
import type { ItemType } from "@/domain/items/item";
import { formatWait, newCardState, schedule } from "@/domain/study/srs";
import { GRADES, type Grade } from "@/domain/study/types";

/** Window for the "reviewed recently" count. */
export const RECENT_HOURS = 24;

export class FlashcardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlashcardError";
  }
}

export interface FlashcardView {
  itemId: string;
  type: ItemType;
  title: string;
  /** Generated interpretation. */
  question: string;
  /** Generated interpretation. */
  answer: string;
  /** Source facts. */
  excerpts: ExcerptView[];
  isNew: boolean;
  /**
   * Identifies this showing of the card (its last review time). Grading sends it
   * back, so a second grade of the same showing is ignored.
   */
  version: string | null;
  /** The wait each grade would give, e.g. { again: "10m", good: "6d" }. */
  waits: Record<Grade, string>;
}

interface Deps {
  store: SrsStore;
  items: Pick<ReviewStore, "getItem">;
  now?: () => Date;
}

/** Flashcards over approved items, scheduled with SM-2. */
export function makeFlashcards({ store, items, now = () => new Date() }: Deps) {
  async function view(card: CardState, at: Date): Promise<FlashcardView | null> {
    const item = await items.getItem(card.itemId);
    if (!item || item.status !== "approved") return null;
    const state = card.state ?? newCardState(at);
    return {
      itemId: item.id,
      type: item.type,
      title: item.title,
      question: item.question,
      answer: item.answer,
      excerpts: item.excerpts,
      isNew: card.state === null,
      version: card.lastReviewedAt?.toISOString() ?? null,
      waits: Object.fromEntries(GRADES.map((grade) => [grade, formatWait(at, schedule(state, grade, at).dueAt)])) as Record<Grade, string>,
    };
  }

  return {
    async next(scope: StudyScope, excludeIds: string[] = []): Promise<{ card: FlashcardView | null; counts: FlashcardCounts }> {
      const at = now();
      const [card, counts] = await Promise.all([
        store.nextCard(scope, at, excludeIds),
        store.counts(scope, at, new Date(at.getTime() - RECENT_HOURS * 3_600_000)),
      ]);
      return { card: card ? await view(card, at) : null, counts };
    },

    /**
     * Grades the showing identified by `version`. If the card was graded since (a
     * double click, a second tab), nothing changes and `recorded` is false, so a
     * card is never scheduled twice for one answer.
     */
    async grade(input: { itemId: string; grade: Grade; version: string | null; sessionId?: string }): Promise<{ recorded: boolean }> {
      const at = now();
      const card = await store.cardState(input.itemId);
      if (!card) throw new FlashcardError("This item is no longer in your library.");
      if ((card.lastReviewedAt?.toISOString() ?? null) !== input.version) return { recorded: false };
      const recorded = await store.record({
        itemId: input.itemId,
        expectedLastReviewedAt: card.lastReviewedAt,
        next: schedule(card.state ?? newCardState(at), input.grade, at),
        grade: input.grade,
        reviewedAt: at,
        sessionId: input.sessionId,
      });
      return { recorded };
    },
  };
}

export type Flashcards = ReturnType<typeof makeFlashcards>;
