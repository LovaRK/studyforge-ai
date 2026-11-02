import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/config/env";
import { globalLoginRateLimitKey } from "@/infrastructure/auth/client-key";
import { SESSION_COOKIE, verifySessionToken } from "@/infrastructure/auth/session-token";

export async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, getEnv().SESSION_SECRET, new Date());
}

/**
 * Data-access guard. The proxy already blocks signed-out requests; every page,
 * Server Action and route handler checks again so a matcher change can't expose data.
 */
export async function requireOwner(): Promise<void> {
  if (!(await isSignedIn())) redirect("/login");
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Shared login rate-limit key; forwarding headers are intentionally ignored. */
export async function clientKey(): Promise<string> {
  return globalLoginRateLimitKey();
}
