import { GRADE_QUALITY, INITIAL_EASE_FACTOR, type Grade, type SrsState } from "./types";

export const MIN_EASE_FACTOR = 1.3;
/** "Again" shows the card once more in the same sitting instead of waiting a day. */
export const RELEARN_MINUTES = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** State of an approved item that has never been reviewed. */
export function newCardState(now: Date): SrsState {
  return { easeFactor: INITIAL_EASE_FACTOR, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now };
}

/**
 * SM-2 (Wozniak, 1990) with one relearning step.
 * - Quality is GRADE_QUALITY[grade]: again 1, hard 3, good 4, easy 5.
 * - Quality ≥ 3: the ease factor moves by 0.1 − (5 − q)(0.08 + (5 − q)·0.02), never
 *   below 1.3, and the interval goes 1 day, 6 days, then the previous interval × the
 *   updated ease factor. (Using the updated factor, as many SM-2 implementations do,
 *   makes Hard, Good and Easy give different waits on a learned card.)
 * - Quality < 3 (Again): repetitions restart and the ease factor is left alone, as in
 *   the original algorithm; the card comes back after RELEARN_MINUTES, and a lapse is
 *   counted if it had been learned before.
 */
export function schedule(state: SrsState, grade: Grade, now: Date): SrsState {
  const quality = GRADE_QUALITY[grade];

  if (quality < 3) {
    return {
      easeFactor: state.easeFactor,
      intervalDays: 0,
      repetitions: 0,
      lapses: state.lapses + (state.repetitions > 0 ? 1 : 0),
      dueAt: new Date(now.getTime() + RELEARN_MINUTES * 60 * 1000),
    };
  }

  const miss = 5 - quality;
  const easeFactor = Math.max(MIN_EASE_FACTOR, round2(state.easeFactor + 0.1 - miss * (0.08 + miss * 0.02)));
  const repetitions = state.repetitions + 1;
  const intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.intervalDays * easeFactor);
  return { easeFactor, intervalDays, repetitions, lapses: state.lapses, dueAt: new Date(now.getTime() + intervalDays * DAY_MS) };
}

/** "10m", "1d", "6d", "3mo", "1.2y": the wait shown on each grade button. */
export function formatWait(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h`;
  const days = Math.round(minutes / (24 * 60));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
