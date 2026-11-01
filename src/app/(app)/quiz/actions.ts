"use server";
import { z } from "zod";
import { isUserFacingError } from "@/application/errors";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { quizScopeSchema } from "@/application/quiz/quiz";
import { logger } from "@/infrastructure/logging/logger";
export async function nextQuizAction(input: unknown, excluded: unknown) {
  await requireOwner();
  const scope = quizScopeSchema.safeParse(input);
  const ids = z.array(z.string().uuid()).max(10000).safeParse(excluded);
  if (!scope.success || !ids.success) return { ok: false as const, error: "Invalid selection." };
  try {
    return { ok: true as const, question: await container().quiz.nextQuestion(scope.data, ids.data) };
  } catch (error) {
    logger.error("quiz question failed", { error });
    return { ok: false as const, error: "Could not load a question. Please try again." };
  }
}
export async function answerQuizAction(input: unknown) {
  await requireOwner();
  const parsed = z
    .object({ id: z.string().uuid(), index: z.number().int().min(0).max(3), sessionId: z.string().uuid().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose a valid answer." };
  try {
    return { ok: true as const, result: await container().quiz.answer(parsed.data.id, parsed.data.index, parsed.data.sessionId) };
  } catch (error) {
    if (isUserFacingError(error)) return { ok: false as const, error: error.message };
    logger.error("quiz answer failed", { error });
    return { ok: false as const, error: "Could not save your answer. Please try again." };
  }
}
