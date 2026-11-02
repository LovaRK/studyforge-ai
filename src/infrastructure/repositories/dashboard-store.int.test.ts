import { afterAll, beforeEach, expect, it } from "vitest";
import { connect, truncateAll } from "@/test/integration/database";
import { sources, items, srsCards, chunks, cardReviews, quizQuestions, quizAttempts } from "@/infrastructure/db/schema";
import { makeDashboard } from "@/application/dashboard/dashboard";
import { DrizzleDashboardStore } from "./drizzle-dashboard-store";
const { client, db } = connect();
beforeEach(() => truncateAll(db));
afterAll(() => client.end());
it("reads persisted progress and extraction counts without join multiplication", async () => {
  const [source] = await db
    .insert(sources)
    .values({ title: "Notes", fileName: "notes.txt", mimeType: "text/plain", text: "An original note.", wordCount: 3 })
    .returning();
  const [item] = await db
    .insert(items)
    .values({
      sourceId: source!.id,
      title: "Note",
      summary: "Note",
      question: "Q?",
      answer: "A",
      type: "concept",
      status: "approved",
      tags: ["notes"],
    })
    .returning();
  await db.insert(srsCards).values({ itemId: item!.id, repetitions: 2, dueAt: new Date("2026-06-12") });
  await db.insert(chunks).values({
    sourceId: source!.id,
    ordinal: 0,
    startOffset: 0,
    endOffset: 17,
    wordCount: 3,
    status: "done",
    itemCount: 4,
    rejectedCount: 1,
  });
  await db
    .insert(cardReviews)
    .values({ itemId: item!.id, grade: "good", intervalDays: 6, easeFactor: 2.5, reviewedAt: new Date("2026-06-10") });
  const [q] = await db.insert(quizQuestions).values({ itemId: item!.id, prompt: "Q?", options: [] }).returning();
  await db.insert(quizAttempts).values([
    { itemId: item!.id, questionId: q!.id, chosenIndex: 0, correct: true, answeredAt: new Date("2026-06-10") },
    { itemId: item!.id, questionId: q!.id, chosenIndex: 1, correct: false, answeredAt: new Date("2026-06-10") },
  ]);
  const d = await makeDashboard(new DrizzleDashboardStore(db), () => new Date("2026-06-10T12:00:00Z")).read();
  expect(d).toMatchObject({ approved: 1, established: 1, due: 0, accuracy: 50, streak: 1, rejectionRate: 20, verified: 4, rejected: 1 });
  expect(d.bySource[0]).toMatchObject({ label: "Notes", total: 1, percent: 100 });
});
