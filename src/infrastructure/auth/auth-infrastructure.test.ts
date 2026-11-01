import { describe, expect, it } from "vitest";
import { MemoryLoginRateLimiter } from "./memory-rate-limiter";
import { ScryptPasswordHasher } from "./scrypt-password-hasher";
import { createSessionToken, verifySessionToken } from "./session-token";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-11-01T10:00:00Z");

describe("ScryptPasswordHasher", () => {
  // Low cost parameters keep the test fast; production uses the defaults.
  const hasher = new ScryptPasswordHasher({ N: 1024, r: 8, p: 1 });

  it("verifies the right password and rejects others", async () => {
    const hash = await hasher.hash("open sesame");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await hasher.verify("open sesame", hash)).toBe(true);
    expect(await hasher.verify("open sesame!", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hasher.hash("same")).not.toBe(await hasher.hash("same"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await hasher.verify("x", "not-a-hash")).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts a fresh token", () => {
    const { token } = createSessionToken(SECRET, NOW);
    expect(verifySessionToken(token, SECRET, NOW)).toBe(true);
  });

  it("rejects expired tokens", () => {
    const { token } = createSessionToken(SECRET, NOW, 60);
    expect(verifySessionToken(token, SECRET, new Date(NOW.getTime() + 61_000))).toBe(false);
  });

  it("rejects tokens signed with another secret or tampered with", () => {
    const { token } = createSessionToken(SECRET, NOW);
    expect(verifySessionToken(token, "b".repeat(32), NOW)).toBe(false);

    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "owner", iat: 0, exp: 9_999_999_999 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${signature}`, SECRET, NOW)).toBe(false);
  });

  it("rejects missing and malformed tokens", () => {
    expect(verifySessionToken(undefined, SECRET, NOW)).toBe(false);
    expect(verifySessionToken("abc", SECRET, NOW)).toBe(false);
    expect(verifySessionToken("a.b.c", SECRET, NOW)).toBe(false);
  });
});

describe("MemoryLoginRateLimiter", () => {
  it("blocks after the limit and reopens when the window passes", () => {
    const limiter = new MemoryLoginRateLimiter({ maxFailures: 2, windowSeconds: 60 });
    limiter.recordFailure("ip", NOW);
    expect(limiter.check("ip", NOW).allowed).toBe(true);
    limiter.recordFailure("ip", NOW);
    expect(limiter.check("ip", NOW)).toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.check("ip", new Date(NOW.getTime() + 60_000)).allowed).toBe(true);
  });

  it("clears failures after a successful login", () => {
    const limiter = new MemoryLoginRateLimiter({ maxFailures: 1, windowSeconds: 60 });
    limiter.recordFailure("ip", NOW);
    limiter.reset("ip");
    expect(limiter.check("ip", NOW).allowed).toBe(true);
  });
});
