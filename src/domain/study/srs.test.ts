import { describe, expect, it } from "vitest";
import { formatWait, MIN_EASE_FACTOR, newCardState, RELEARN_MINUTES, schedule } from "./srs";
import { GRADES, type Grade, type SrsState } from "./types";

const NOW = new Date("2026-11-01T09:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function run(grades: Grade[], start: SrsState = newCardState(NOW)): SrsState {
  return grades.reduce((state, grade) => schedule(state, grade, NOW), start);
}

describe("SM-2 schedule", () => {
  it("starts new cards at ease 2.5, due now", () => {
    expect(newCardState(NOW)).toEqual({ easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: NOW });
  });

  it("goes 1 day, 6 days, then interval × the updated ease factor on Good", () => {
    const first = run(["good"]);
    expect(first).toMatchObject({ repetitions: 1, intervalDays: 1, easeFactor: 2.5, dueAt: days(1) });
    const second = run(["good", "good"]);
    expect(second).toMatchObject({ repetitions: 2, intervalDays: 6, dueAt: days(6) });
    // Good (q = 4) leaves the ease factor at 2.5: 6 × 2.5 = 15.
    expect(run(["good", "good", "good"])).toMatchObject({ repetitions: 3, intervalDays: 15, easeFactor: 2.5 });
  });

  it("moves the ease factor by the SM-2 formula: Easy +0.10, Good 0, Hard −0.14", () => {
    expect(run(["easy"]).easeFactor).toBe(2.6);
    expect(run(["good"]).easeFactor).toBe(2.5);
    expect(run(["hard"]).easeFactor).toBe(2.36);
    expect(run(["easy", "easy", "easy"])).toMatchObject({ easeFactor: 2.8, intervalDays: Math.round(6 * 2.8) });
    // So a learned card's grades lead to different waits.
    const learned = run(["good", "good"]);
    expect(["hard", "good", "easy"].map((g) => schedule(learned, g as Grade, NOW).intervalDays)).toEqual([14, 15, 16]);
  });

  it("never lets the ease factor fall below 1.3", () => {
    expect(run(Array<Grade>(20).fill("hard")).easeFactor).toBe(MIN_EASE_FACTOR);
  });

  it("restarts on Again, keeps the ease factor, counts a lapse only for a learned card, and shows it again soon", () => {
    const learned = run(["good", "good", "hard"]);
    const lapsed = schedule(learned, "again", NOW);
    expect(lapsed).toEqual({
      easeFactor: learned.easeFactor,
      intervalDays: 0,
      repetitions: 0,
      lapses: 1,
      dueAt: new Date(NOW.getTime() + RELEARN_MINUTES * 60_000),
    });
    expect(schedule(newCardState(NOW), "again", NOW).lapses).toBe(0);
    // After a lapse the card is relearned from the first interval.
    expect(schedule(lapsed, "good", NOW)).toMatchObject({ repetitions: 1, intervalDays: 1 });
  });

  it("never schedules a passing grade sooner than a failing one", () => {
    for (const start of [newCardState(NOW), run(["good", "good"]), run(["hard", "hard", "hard"])]) {
      const dues = GRADES.map((grade) => schedule(start, grade, NOW).dueAt.getTime());
      expect([...dues].sort((a, b) => a - b)).toEqual(dues);
    }
  });
});

describe("formatWait", () => {
  it.each([
    [10 / 1440, "10m"],
    [0.25, "6h"],
    [1, "1d"],
    [15, "15d"],
    [90, "3mo"],
    [500, "1.4y"],
  ])("%s days → %s", (n, label) => {
    expect(formatWait(NOW, days(n))).toBe(label);
  });
});
