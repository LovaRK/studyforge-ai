import type { Grade, SessionScope, SrsState } from "@/domain/study/types";

/** What a study run draws from: everything, one tag, or one source. */
export interface StudyScope {
  scope: SessionScope;
  /** The tag or source id; ignored for "all". */
  value?: string;
}

export interface CardState {
  itemId: string;
  /** Null for an approved item that has never been studied. */
  state: SrsState | null;
  lastReviewedAt: Date | null;
}

export interface FlashcardCounts {
  /** Studied cards whose due time has come. */
  due: number;
  /** Approved items never studied. */
  new: number;
  reviewedSince: number;
  /** The earliest future due time, for "next card in …". */
  nextDueAt: Date | null;
}

export interface GradeRecord {
  itemId: string;
  /** The card's lastReviewedAt when it was shown (null for a new card). */
  expectedLastReviewedAt: Date | null;
  next: SrsState;
  grade: Grade;
  reviewedAt: Date;
  sessionId?: string;
}

/** Spaced-repetition state. Approved items only, everywhere. */
export interface SrsStore {
  /** Due cards first (earliest due), then new cards (earliest approved); null when nothing is ready. */
  nextCard(scope: StudyScope, now: Date, excludeIds: string[]): Promise<CardState | null>;
  /** Current state of one approved item, or null if it is not approved. */
  cardState(itemId: string): Promise<CardState | null>;
  counts(scope: StudyScope, now: Date, reviewedSince: Date): Promise<FlashcardCounts>;
  /**
   * Saves the new state and appends a review, atomically, only if the item is still
   * approved and nobody graded it since it was shown. Returns false otherwise.
   */
  record(review: GradeRecord): Promise<boolean>;
}
