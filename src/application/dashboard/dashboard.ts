import type { DashboardItem, DashboardSnapshot, DashboardStore } from "@/application/ports/dashboard";
const day = (date: Date) => date.toISOString().slice(0, 10);
export interface MasteryGroup {
  key: string;
  label: string;
  total: number;
  established: number;
  percent: number;
}
function groups(items: DashboardItem[], kind: "tag" | "source"): MasteryGroup[] {
  const result = new Map<string, MasteryGroup>();
  for (const item of items)
    for (const key of kind === "tag" ? [...new Set(item.tags)] : [item.sourceId]) {
      const group = result.get(key) ?? { key, label: kind === "tag" ? key : item.sourceTitle, total: 0, established: 0, percent: 0 };
      group.total++;
      group.established += Number((item.repetitions ?? 0) >= 2);
      group.percent = Math.round((100 * group.established) / group.total);
      result.set(key, group);
    }
  return [...result.values()].sort((a, b) => a.label.localeCompare(b.label));
}
export function summarizeDashboard(data: DashboardSnapshot, now: Date) {
  const approved = data.items.filter((i) => i.status === "approved");
  const activity = data.activity.filter((a) => a.at <= now);
  const activeDays = new Set(activity.map((a) => day(a.at)));
  let streak = 0;
  const cursor = new Date(`${day(now)}T00:00:00Z`);
  if (!activeDays.has(day(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (activeDays.has(day(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  const quizzes = activity.filter((a) => a.kind === "quiz");
  const correct = quizzes.filter((a) => a.correct).length;
  const extracted = data.extraction.verified + data.extraction.rejected;
  return {
    approved: approved.length,
    pending: data.items.filter((i) => i.status === "pending").length,
    edited: data.items.filter((i) => i.edited).length,
    merged: data.items.filter((i) => i.status === "merged").length,
    discarded: data.items.filter((i) => i.status === "discarded").length,
    due: approved.filter((i) => !i.dueAt || i.dueAt <= now).length,
    newCards: approved.filter((i) => i.repetitions === null).length,
    established: approved.filter((i) => (i.repetitions ?? 0) >= 2).length,
    streak,
    accuracy: quizzes.length ? Math.round((100 * correct) / quizzes.length) : null,
    quizAnswers: quizzes.length,
    cardAnswers: activity.filter((a) => a.kind === "card").length,
    rejectionRate: extracted ? Math.round((100 * data.extraction.rejected) / extracted) : null,
    rejected: data.extraction.rejected,
    verified: data.extraction.verified,
    byTag: groups(approved, "tag"),
    bySource: groups(approved, "source"),
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - 6 + i);
      const date = day(d);
      return { date, count: activity.filter((a) => day(a.at) === date).length };
    }),
  };
}
export function makeDashboard(store: DashboardStore, now = () => new Date()) {
  return {
    async read() {
      return summarizeDashboard(await store.snapshot(), now());
    },
  };
}
