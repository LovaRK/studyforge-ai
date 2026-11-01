import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/config/env";
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

/** Key for login rate limiting: the first forwarded client address. */
export async function clientKey(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
