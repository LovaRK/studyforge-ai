import { expect, it } from "vitest";
import type { DashboardSnapshot } from "@/application/ports/dashboard";
import { summarizeDashboard } from "./dashboard";
const now = new Date("2026-06-10T12:00:00Z");
const empty: DashboardSnapshot = { items: [], activity: [], extraction: { verified: 0, rejected: 0 } };
it("shows missing measurements without claiming zero accuracy or mastery", () => {
  expect(summarizeDashboard(empty, now)).toMatchObject({ accuracy: null, rejectionRate: null, streak: 0, due: 0, byTag: [], bySource: [] });
});
it("groups approved items only, includes new cards as due, and counts edited/merged states", () => {
  const base = {
    id: "1",
    sourceId: "s",
    sourceTitle: "Notes",
    tags: ["swift"],
    status: "approved" as const,
    edited: false,
    repetitions: null,
    dueAt: null,
  };
  const d = summarizeDashboard(
    {
      ...empty,
      items: [
        base,
        { ...base, id: "2", repetitions: 2, dueAt: new Date("2026-06-11") },
        { ...base, id: "3", status: "merged", edited: true },
      ],
      extraction: { verified: 3, rejected: 1 },
    },
    now,
  );
  expect(d).toMatchObject({ approved: 2, due: 1, newCards: 1, established: 1, merged: 1, edited: 1, rejectionRate: 25 });
  expect(d.byTag).toEqual([{ key: "swift", label: "swift", total: 2, established: 1, percent: 50 }]);
});
it("uses UTC days, accepts yesterday as an active streak, and excludes future activity", () => {
  const activity: DashboardSnapshot["activity"] = [
    { at: new Date("2026-06-09T23:59:00Z"), kind: "quiz", correct: true },
    { at: new Date("2026-06-09T20:00:00Z"), kind: "quiz", correct: false },
    { at: new Date("2026-06-08T00:01:00Z"), kind: "card", correct: null },
    { at: new Date("2026-06-11T00:00:00Z"), kind: "quiz", correct: true },
  ];
  const d = summarizeDashboard({ ...empty, activity }, now);
  expect(d).toMatchObject({ streak: 2, accuracy: 50, quizAnswers: 2, cardAnswers: 1 });
  expect(d.days.at(-2)).toEqual({ date: "2026-06-09", count: 2 });
  expect(summarizeDashboard({ ...empty, activity }, new Date("2026-06-15")).streak).toBe(0);
});
