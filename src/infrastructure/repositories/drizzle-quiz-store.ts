import { and, arrayContains, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { QuizError, type QuizAnswer, type QuizScope, type QuizStore, type StoredQuestion } from "@/application/ports/quiz";
import type { Database } from "@/infrastructure/db/client";
import { items, quizQuestions, quizAttempts, studySessions } from "@/infrastructure/db/schema";
import { DrizzleReviewStore } from "./drizzle-review-store";
const optionsSchema = z
  .array(z.object({ text: z.string().min(1), correct: z.boolean(), provenance: z.literal("generated"), itemId: z.string().uuid() }))
  .min(2)
  .max(4)
  .refine((o) => o.filter((v) => v.correct).length === 1);
export class DrizzleQuizStore implements QuizStore {
  constructor(private readonly db: Database) {}
  async candidates(scope: QuizScope) {
    return this.db
      .select({ id: items.id, question: items.question, answer: items.answer })
      .from(items)
      .where(
        and(
          eq(items.status, "approved"),
          scope.scope === "tag" ? arrayContains(items.tags, [scope.value!]) : undefined,
          scope.scope === "source" ? eq(items.sourceId, scope.value!) : undefined,
        ),
      )
      .orderBy(asc(items.reviewedAt), asc(items.id));
  }
  async save(question: Omit<StoredQuestion, "id">): Promise<StoredQuestion> {
    const options = optionsSchema.parse(question.options);
    const [row] = await this.db
      .insert(quizQuestions)
      .values({ ...question, options })
      .returning();
    return { ...row!, options };
  }
  async answer(id: string, chosenIndex: number, sessionId?: string): Promise<QuizAnswer> {
    return this.db.transaction(async (tx) => {
      // A question is one showing. Lock it so concurrent submits record only once.
      const [question] = await tx.select().from(quizQuestions).where(eq(quizQuestions.id, id)).for("update");
      if (!question) throw new QuizError("This question is no longer available.");
      const options = optionsSchema.parse(question.options);
      if (!options[chosenIndex]) throw new QuizError("Choose one of the offered answers.");
      const referenced = [...new Set([question.itemId, ...options.map((o) => o.itemId)])];
      const approved = await tx
        .select({ id: items.id, tags: items.tags, sourceId: items.sourceId })
        .from(items)
        .where(and(inArray(items.id, referenced), eq(items.status, "approved")))
        .orderBy(asc(items.id))
        .for("share");
      if (approved.length !== referenced.length)
        throw new QuizError("An item in this question is no longer approved. Start a new question.");
      const [previous] = await tx.select().from(quizAttempts).where(eq(quizAttempts.questionId, id));
      if (previous && previous.sessionId !== (sessionId ?? null))
        throw new QuizError("This question was already answered in another study run.");
      if (!previous && sessionId) {
        const [session] = await tx.select().from(studySessions).where(eq(studySessions.id, sessionId)).for("update");
        const target = approved.find((i) => i.id === question.itemId)!;
        if (
          !session ||
          session.endedAt ||
          Date.now() >= session.startedAt.getTime() + session.plannedMinutes * 60000 ||
          (session.scope === "tag" && !target.tags.includes(session.scopeValue!)) ||
          (session.scope === "source" && target.sourceId !== session.scopeValue)
        )
          throw new QuizError("This session has ended or the question is outside its selection.");
        const seen = await tx.execute(sql`select 1 from quiz_attempts where session_id = ${sessionId} and item_id = ${question.itemId}
          union all select 1 from card_reviews where session_id = ${sessionId} and item_id = ${question.itemId}`);
        if (seen.length) throw new QuizError("This item has already been studied in this session.");
      }
      const correctIndex = options.findIndex((o) => o.correct);
      const chosen = previous?.chosenIndex ?? chosenIndex;
      if (!previous)
        await tx
          .insert(quizAttempts)
          .values({ questionId: id, itemId: question.itemId, sessionId, chosenIndex, correct: chosenIndex === correctIndex });
      const item = await new DrizzleReviewStore(tx as unknown as Database).getItem(question.itemId);
      return { correct: chosen === correctIndex, correctIndex, chosenIndex: chosen, excerpts: item!.excerpts };
    });
  }
}
