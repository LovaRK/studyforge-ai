"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isUserFacingError } from "@/application/errors";
import { ITEM_TYPES } from "@/domain/items/item";
import { logger } from "@/infrastructure/logging/logger";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const ids = z.array(z.string().uuid()).min(1).max(200);
const fields = z.object({
  type: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1, "Title is required.").max(200),
  summary: z.string().trim().min(1, "Summary is required.").max(4000),
  question: z.string().trim().min(1, "Question is required.").max(1000),
  answer: z.string().trim().min(1, "Answer is required.").max(4000),
});

/** Shared guard: auth, validation, error mapping and cache refresh for every review action. */
async function run<T>(schema: z.ZodType<T>, input: unknown, act: (value: T) => Promise<string | void>): Promise<ActionResult> {
  await requireOwner();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const id = await act(parsed.data);
    revalidatePath("/review");
    return { ok: true, ...(id ? { id } : {}) };
  } catch (error) {
    if (isUserFacingError(error)) return { ok: false, error: error.message };
    logger.error("review action failed", { error });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function approveAction(itemIds: string[]) {
  return run(ids, itemIds, async (v) => void (await container().review.approve(v)));
}

export async function discardAction(itemIds: string[]) {
  return run(ids, itemIds, async (v) => void (await container().review.discard(v)));
}

export async function editAction(itemId: string, input: z.infer<typeof fields>) {
  return run(z.object({ id: z.string().uuid(), fields }), { id: itemId, fields: input }, (v) => container().review.edit(v.id, v.fields));
}

export async function tagAction(itemId: string, tags: string[]) {
  return run(z.object({ id: z.string().uuid(), tags: z.array(z.string().max(40)).max(12) }), { id: itemId, tags }, (v) =>
    container().review.tag(v.id, v.tags),
  );
}

export async function mergeAction(itemIds: string[]) {
  return run(ids, itemIds, (v) => container().review.merge(v));
}
