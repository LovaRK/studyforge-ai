/**
 * Shared vocabulary for the study tools (flashcards, quizzes, sessions, dashboard).
 * The tables in `infrastructure/db/schema.ts` store exactly these values.
 */

/** SM-2 answer buttons. Quality (0–5) is what the SM-2 formula consumes. */
export const GRADES = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof GRADES)[number];
export const GRADE_QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

/** Spaced-repetition state of one approved item. */
export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: Date;
}

export const INITIAL_EASE_FACTOR = 2.5;

/**
 * Where a quiz option's wording comes from. Correct answers and source-checked
 * distractors are "source"; anything else is "generated" and must be labelled so.
 */
export const OPTION_PROVENANCES = ["source", "generated"] as const;
export type OptionProvenance = (typeof OPTION_PROVENANCES)[number];

export interface QuizOption {
  text: string;
  correct: boolean;
  provenance: OptionProvenance;
  /** The approved item this option was taken from, when it came from one. */
  itemId?: string;
}

/** What a focused study session draws from. */
export const SESSION_SCOPES = ["all", "tag", "source"] as const;
export type SessionScope = (typeof SESSION_SCOPES)[number];
