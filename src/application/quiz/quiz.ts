import { z } from "zod";
import type { QuizScope, QuizStore } from "@/application/ports/quiz";
import { buildQuestion } from "@/domain/quiz/question";
export { QuizError } from "@/application/ports/quiz";
export const quizScopeSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }),
  z.object({ scope: z.literal("tag"), value: z.string().trim().min(1).max(40) }),
  z.object({ scope: z.literal("source"), value: z.string().uuid() }),
]);
export interface QuizQuestionView {
  id: string;
  itemId: string;
  prompt: string;
  options: { text: string; provenance: "generated" }[];
}
export function makeQuiz({ store, random = Math.random }: { store: QuizStore; random?: () => number }) {
  return {
    /** excludeIds are ITEM ids, shared with flashcards and focused sessions. */
    async nextQuestion(scope: QuizScope, excludeIds: string[] = []): Promise<QuizQuestionView | null> {
      const parsed = quizScopeSchema.parse(scope);
      const excluded = new Set(z.array(z.string().uuid()).max(10000).parse(excludeIds));
      const candidates = await store.candidates(parsed);
      for (const item of candidates) {
        if (excluded.has(item.id)) continue;
        const built = buildQuestion(item, candidates, random);
        if (!built) continue;
        const saved = await store.save(built);
        // Do not serialize correctness or source excerpts before the answer.
        return {
          id: saved.id,
          itemId: saved.itemId,
          prompt: saved.prompt,
          options: saved.options.map(({ text, provenance }) => ({ text, provenance })),
        };
      }
      return null;
    },
    answer(questionId: string, chosenIndex: number, sessionId?: string) {
      const input = z
        .object({ questionId: z.string().uuid(), chosenIndex: z.number().int().min(0).max(3), sessionId: z.string().uuid().optional() })
        .parse({ questionId, chosenIndex, sessionId });
      return store.answer(input.questionId, input.chosenIndex, input.sessionId);
    },
  };
}
export type Quiz = ReturnType<typeof makeQuiz>;
