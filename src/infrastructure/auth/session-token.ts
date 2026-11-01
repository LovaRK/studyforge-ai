import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionIssuer } from "@/application/ports/auth";

export const SESSION_COOKIE = "sf_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type Payload = { sub: "owner"; iat: number; exp: number };

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

/** Stateless session token: base64url(payload) + "." + HMAC-SHA256 signature. */
export function createSessionToken(secret: string, now: Date, ttlSeconds = SESSION_TTL_SECONDS) {
  const iat = Math.floor(now.getTime() / 1000);
  const payload: Payload = { sub: "owner", iat, exp: iat + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${body}.${sign(body, secret)}`, expiresAt: new Date(payload.exp * 1000) };
}

export function verifySessionToken(token: string | undefined, secret: string, now: Date): boolean {
  if (!token) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return false;

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Payload>;
    return payload.sub === "owner" && typeof payload.exp === "number" && payload.exp > now.getTime() / 1000;
  } catch {
    return false;
  }
}

export class HmacSessionIssuer implements SessionIssuer {
  constructor(private readonly secret: string) {}

  issue(now: Date) {
    return createSessionToken(this.secret, now);
  }
}
