"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_MINUTES, StudySessionError } from "@/application/study-session/study-session";
import { logger } from "@/infrastructure/logging/logger";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export type StartState = { error?: string };

const startInput = z.object({
  // "", "tag:<name>" or "source:<uuid>", as the scope select sends it.
  scope: z.union([
    z.literal("").transform(() => ({ scope: "all" as const })),
    z.templateLiteral(["tag:", z.string()]).transform((v) => ({ scope: "tag" as const, value: v.slice(4) })),
    z.templateLiteral(["source:", z.uuid()]).transform((v) => ({ scope: "source" as const, value: v.slice(7) })),
  ]),
  minutes: z.coerce.number().int().min(SESSION_MINUTES.min).max(SESSION_MINUTES.max),
});

export async function startSessionAction(_state: StartState, formData: FormData): Promise<StartState> {
  await requireOwner();
  const parsed = startInput.safeParse({ scope: formData.get("scope") ?? "", minutes: formData.get("minutes") });
  if (!parsed.success) return { error: `Choose what to study and between ${SESSION_MINUTES.min} and ${SESSION_MINUTES.max} minutes.` };

  let id: string;
  try {
    id = await container().studySessions.start(parsed.data.scope, parsed.data.minutes);
  } catch (error) {
    if (error instanceof StudySessionError) return { error: error.message };
    logger.error("starting a study session failed", { error });
    return { error: "Something went wrong. Please try again." };
  }
  redirect(`/study/${id}`);
}

export async function finishSessionAction(sessionId: string): Promise<void> {
  await requireOwner();
  const id = z.uuid().parse(sessionId);
  await container().studySessions.finish(id);
  redirect(`/study/${id}`);
}
