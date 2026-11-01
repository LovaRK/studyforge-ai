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
 * Where a quiz option's *wording* comes from, independent of whether the option
 * is correct and of whether its item was approved:
 * - "source": the text is a verified verbatim excerpt, exactly
 *   `source.text.slice(excerpt.start, excerpt.end)`.
 * - "generated": any model wording, including an approved item's `answer` or
 *   `summary`. Approval does not turn generated text into a source fact.
 */
export const OPTION_PROVENANCES = ["source", "generated"] as const;
export type OptionProvenance = (typeof OPTION_PROVENANCES)[number];

interface QuizOptionBase {
  text: string;
  correct: boolean;
}

/** Verbatim source text. Must carry the excerpt it was copied from, so it can be re-verified. */
export interface SourceQuizOption extends QuizOptionBase {
  provenance: "source";
  itemId: string;
  excerpt: { sourceId: string; start: number; end: number };
}

/** Model wording. Shown with a "Generated" label. */
export interface GeneratedQuizOption extends QuizOptionBase {
  provenance: "generated";
  /** The approved item whose generated wording was used, if any. */
  itemId?: string;
}

export type QuizOption = SourceQuizOption | GeneratedQuizOption;

/** True when a "source" option's text is exactly the excerpt it points to. */
export function isVerbatimSourceOption(option: SourceQuizOption, sourceText: string): boolean {
  return sourceText.slice(option.excerpt.start, option.excerpt.end) === option.text;
}

/** What a focused study session draws from. */
export const SESSION_SCOPES = ["all", "tag", "source"] as const;
export type SessionScope = (typeof SESSION_SCOPES)[number];
