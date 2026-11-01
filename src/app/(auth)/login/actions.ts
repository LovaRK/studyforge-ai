"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { logger } from "@/infrastructure/logging/logger";
import { container } from "@/server/container";
import { clientKey, setSessionCookie } from "@/server/session";

export type LoginState = { error?: string };

const loginInput = z.object({ password: z.string().min(1, "Enter your password.").max(256) });

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginInput.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your password." };

  const key = await clientKey();
  const result = await container().login({ password: parsed.data.password, clientKey: key });

  if (!result.ok) {
    logger.warn("login failed", { reason: result.reason });
    if (result.reason === "rate_limited") {
      const minutes = Math.ceil(result.retryAfterSeconds / 60);
      return { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
    }
    return { error: "That password is not correct." };
  }

  await setSessionCookie(result.token, result.expiresAt);
  logger.info("login succeeded");
  redirect("/");
}
