import { and, arrayContains, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { QuizError, type QuizAnswer, type QuizScope, type QuizStore, type StoredQuestion } from "@/application/ports/quiz";
import type { Database } from "@/infrastructure/db/client";
import { items, quizQuestions, quizAttempts } from "@/infrastructure/db/schema";
import { DrizzleReviewStore } from "./drizzle-review-store";
import { sessionAcceptsAnswer } from "./study-session-guard";

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
    const [existing] = await this.db
      .select({ question: quizQuestions })
      .from(quizQuestions)
      .leftJoin(quizAttempts, eq(quizAttempts.questionId, quizQuestions.id))
      .where(and(eq(quizQuestions.itemId, question.itemId), isNull(quizAttempts.id)))
      .orderBy(desc(quizQuestions.createdAt), desc(quizQuestions.id))
      .limit(1);
    if (existing) return { ...existing.question, options: optionsSchema.parse(existing.question.options) };

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
      const target = approved.find((item) => item.id === question.itemId)!;
      if (!previous && sessionId && !(await sessionAcceptsAnswer(tx, sessionId, target, new Date())))
        throw new QuizError("This session has ended, the item is outside its selection, or it was already studied.");
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
