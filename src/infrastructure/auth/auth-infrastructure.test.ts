import { describe, expect, it } from "vitest";
import { clientKeyFromForwardedFor } from "./client-key";
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

describe("clientKeyFromForwardedFor", () => {
  it("uses the address appended by our proxy, not one the client sent", () => {
    expect(clientKeyFromForwardedFor("203.0.113.7")).toBe("203.0.113.7");
    expect(clientKeyFromForwardedFor("1.2.3.4, 203.0.113.7")).toBe("203.0.113.7");
    expect(clientKeyFromForwardedFor(" 9.9.9.9 ,  203.0.113.7 ")).toBe("203.0.113.7");
  });

  it("falls back to one local bucket without a usable header", () => {
    expect(clientKeyFromForwardedFor(null)).toBe("local");
    expect(clientKeyFromForwardedFor("")).toBe("local");
    expect(clientKeyFromForwardedFor("1.2.3.4, ")).toBe("local");
  });

  it("keeps a spoofing client in one bucket however it rotates the header", () => {
    const limiter = new MemoryLoginRateLimiter({ maxFailures: 2, windowSeconds: 60 });
    for (const spoofed of ["10.0.0.1", "10.0.0.2", "10.0.0.3"])
      limiter.recordFailure(clientKeyFromForwardedFor(`${spoofed}, 203.0.113.7`), NOW);
    expect(limiter.check(clientKeyFromForwardedFor("10.0.0.4, 203.0.113.7"), NOW).allowed).toBe(false);
  });
});
