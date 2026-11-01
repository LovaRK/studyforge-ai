/**
 * Rate-limit key from an `X-Forwarded-For` header. Each proxy appends the address it
 * received the request from, so only the last entry is written by our own proxy; every
 * earlier entry can be sent by the client and must not decide which bucket it lands in.
 */
export function clientKeyFromForwardedFor(forwarded: string | null): string {
  return forwarded?.split(",").at(-1)?.trim() || "local";
}
