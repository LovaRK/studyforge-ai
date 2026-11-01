"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isUserFacingError } from "@/application/errors";
import { GRADES } from "@/domain/study/types";
import { logger } from "@/infrastructure/logging/logger";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export type GradeResult = { ok: true; recorded: boolean } | { ok: false; error: string };

const gradeInput = z.object({
  itemId: z.string().uuid(),
  grade: z.enum(GRADES),
  version: z.string().datetime().nullable(),
  sessionId: z.string().uuid().optional(),
});

export async function gradeCardAction(input: z.input<typeof gradeInput>): Promise<GradeResult> {
  await requireOwner();
  const parsed = gradeInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid grade." };
  try {
    const { recorded } = await container().flashcards.grade(parsed.data);
    revalidatePath("/flashcards");
    return { ok: true, recorded };
  } catch (error) {
    if (isUserFacingError(error)) return { ok: false, error: error.message };
    logger.error("grading a flashcard failed", { error });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
