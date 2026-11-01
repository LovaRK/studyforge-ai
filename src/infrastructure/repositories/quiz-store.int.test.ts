import { eq } from "drizzle-orm";
import { afterAll, beforeEach, expect, it } from "vitest";
import { makeQuiz } from "@/application/quiz/quiz";
import { sources, items, itemExcerpts, quizAttempts, quizQuestions, studySessions } from "@/infrastructure/db/schema";
import { connect, truncateAll } from "@/test/integration/database";
import { DrizzleQuizStore } from "./drizzle-quiz-store";
const { client, db } = connect();
const store = new DrizzleQuizStore(db);
const quiz = makeQuiz({ store, random: () => 0 });
let sourceId: string;
beforeEach(async () => {
  await truncateAll(db);
  const [source] = await db
    .insert(sources)
    .values({
      title: "Garden",
      fileName: "garden.txt",
      mimeType: "text/plain",
      text: "Water the roots. Label each pot. Check the soil.",
      wordCount: 9,
    })
    .returning();
  sourceId = source!.id;
  for (const [i, text] of ["Water the roots.", "Label each pot.", "Check the soil."].entries()) {
    const [item] = await db
      .insert(items)
      .values({
        sourceId,
        type: "concept",
        title: text,
        summary: text,
        question: `What is step ${i + 1}?`,
        answer: text,
        status: i === 2 ? "pending" : "approved",
        tags: ["garden"],
      })
      .returning();
    await db.insert(itemExcerpts).values({
      sourceId,
      itemId: item!.id,
      text,
      startOffset: source!.text.indexOf(text),
      endOffset: source!.text.indexOf(text) + text.length,
    });
  }
});
afterAll(() => client.end());
it("uses only approved items with tag/source filters and reveals exact excerpts after answering", async () => {
  expect(await store.candidates({ scope: "all" })).toHaveLength(2);
  expect(await store.candidates({ scope: "tag", value: "missing" })).toHaveLength(0);
  const q = (await quiz.nextQuestion({ scope: "source", value: sourceId }))!;
  expect(JSON.stringify(q)).not.toContain('"correct"');
  const answer = await quiz.answer(q.id, 0);
  expect(answer.excerpts).toHaveLength(1);
  expect(answer.excerpts[0]!.sourceTitle).toBe("Garden");
  expect(answer.excerpts[0]!.text).toBe(q.options[answer.correctIndex]!.text);
});
it("serializes double submits and preserves the first answer", async () => {
  const q = (await quiz.nextQuestion({ scope: "all" }))!;
  const answers = await Promise.all([quiz.answer(q.id, 0), quiz.answer(q.id, 1)]);
  expect(answers[0]).toEqual(answers[1]);
  expect(await db.select().from(quizAttempts)).toHaveLength(1);
});
it("expires abandoned questions without sharing a recent showing", async () => {
  const first = (await quiz.nextQuestion({ scope: "all" }))!;
  await db
    .update(quizQuestions)
    .set({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
    .where(eq(quizQuestions.id, first.id));
  const second = (await quiz.nextQuestion({ scope: "all" }))!;
  expect(second.id).not.toBe(first.id);
  expect(second.itemId).toBe(first.itemId);
  expect(await db.select().from(quizQuestions)).toHaveLength(1);
});
it("expires any item's abandoned questions, but never one that is being answered", async () => {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const abandoned = (await quiz.nextQuestion({ scope: "all" }))!;
  const answered = (await quiz.nextQuestion({ scope: "all" }))!;
  await quiz.answer(answered.id, 0);
  const open = (await quiz.nextQuestion({ scope: "all" }))!;
  await db.update(quizQuestions).set({ createdAt: twoDaysAgo });

  // Another tab holds the open question while answering it.
  await db.transaction(async (tx) => {
    await tx.select().from(quizQuestions).where(eq(quizQuestions.id, open.id)).for("update");
    // Showing a question about the other item skips the locked row instead of waiting.
    await quiz.nextQuestion({ scope: "all" }, [abandoned.itemId]);
  });
  const left = (await db.select({ id: quizQuestions.id }).from(quizQuestions)).map((q) => q.id);
  expect(left).not.toContain(abandoned.id);
  expect(left).toEqual(expect.arrayContaining([answered.id, open.id]));
  expect(await db.select().from(quizAttempts)).toHaveLength(1);
});
it("keeps concurrent showings independent", async () => {
  const [first, second] = await Promise.all([quiz.nextQuestion({ scope: "all" }), quiz.nextQuestion({ scope: "all" })]);
  expect(first!.id).not.toBe(second!.id);
  await expect(Promise.all([quiz.answer(first!.id, 0), quiz.answer(second!.id, 1)])).resolves.toHaveLength(2);
  expect(await db.select().from(quizAttempts)).toHaveLength(2);
});
it("rejects a question if any option is no longer approved", async () => {
  const q = (await quiz.nextQuestion({ scope: "all" }))!;
  await db.update(items).set({ status: "discarded" }).where(eq(items.id, q.itemId));
  await expect(quiz.answer(q.id, 0)).rejects.toThrow("no longer approved");
  expect(await db.select().from(quizAttempts)).toHaveLength(0);
});
it("rejects expired, ended and out-of-scope sessions without recording an answer", async () => {
  for (const patch of [
    { endedAt: new Date(), endReason: "finished" as const },
    { startedAt: new Date(Date.now() - 120000) },
    { scope: "tag" as const, scopeValue: "missing" },
  ]) {
    const [s] = await db
      .insert(studySessions)
      .values({ scope: "all", plannedMinutes: 1, ...patch })
      .returning();
    const q = (await quiz.nextQuestion({ scope: "all" }))!;
    await expect(quiz.answer(q.id, 0, s!.id)).rejects.toThrow("session has ended");
  }
  expect(await db.select().from(quizAttempts)).toHaveLength(0);
});
it("records an active session once and prevents studying the same item twice", async () => {
  const [s] = await db.insert(studySessions).values({ scope: "source", scopeValue: sourceId, plannedMinutes: 5 }).returning();
  const q = (await quiz.nextQuestion({ scope: "all" }))!;
  await quiz.answer(q.id, 0, s!.id);
  const again = (await quiz.nextQuestion({ scope: "all" }))!;
  await expect(quiz.answer(again.id, 0, s!.id)).rejects.toThrow("already studied");
  expect(await db.select().from(quizAttempts)).toHaveLength(1);
});
