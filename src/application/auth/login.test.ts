import { describe, expect, it } from "vitest";
import { MemoryLoginRateLimiter } from "@/infrastructure/auth/memory-rate-limiter";
import { HmacSessionIssuer, verifySessionToken } from "@/infrastructure/auth/session-token";
import { InMemoryOwnerCredentialStore, PlainTextHasher } from "@/test/fakes";
import { makeLogin } from "./login";
import { ensureOwnerCredential } from "./owner-credential";

const SECRET = "s".repeat(32);
const NOW = new Date("2026-11-01T10:00:00Z");

function setup(storedHash: string | null = null) {
  const store = new InMemoryOwnerCredentialStore(storedHash);
  const login = makeLogin({
    store,
    hasher: new PlainTextHasher(),
    sessions: new HmacSessionIssuer(SECRET),
    limiter: new MemoryLoginRateLimiter({ maxFailures: 3, windowSeconds: 60 }),
    ownerPassword: "correct horse",
    now: () => NOW,
  });
  return { store, login };
}

describe("login", () => {
  it("issues a valid session for the owner password", async () => {
    const { login } = setup();
    const result = await login({ password: "correct horse", clientKey: "ip" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(verifySessionToken(result.token, SECRET, NOW)).toBe(true);
  });

  it("hashes the owner password on first use", async () => {
    const { store, login } = setup();
    await login({ password: "anything", clientKey: "ip" });
    expect(store.hash).toBe("plain:correct horse");
  });

  it("rejects a wrong password", async () => {
    const { login } = setup();
    expect(await login({ password: "nope", clientKey: "ip" })).toEqual({ ok: false, reason: "invalid_credentials" });
  });

  it("rate-limits repeated failures per client and leaves others alone", async () => {
    const { login } = setup();
    for (let i = 0; i < 3; i++) await login({ password: "nope", clientKey: "attacker" });

    const blocked = await login({ password: "correct horse", clientKey: "attacker" });
    expect(blocked).toMatchObject({ ok: false, reason: "rate_limited" });
    expect((await login({ password: "correct horse", clientKey: "owner" })).ok).toBe(true);
  });

  it("atomically caps simultaneous password checks", async () => {
    let verifies = 0;
    const store = new InMemoryOwnerCredentialStore("plain:correct horse");
    const login = makeLogin({
      store,
      hasher: {
        hash: async (password) => `plain:${password}`,
        verify: async () => {
          verifies += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return false;
        },
      },
      sessions: new HmacSessionIssuer(SECRET),
      limiter: new MemoryLoginRateLimiter({ maxFailures: 3, windowSeconds: 60 }),
      ownerPassword: "correct horse",
      now: () => NOW,
    });

    const results = await Promise.all(Array.from({ length: 10 }, () => login({ password: "nope", clientKey: "attacker" })));
    expect(verifies).toBe(3);
    expect(results.filter((result) => result.ok === false && result.reason === "rate_limited")).toHaveLength(7);
  });
});

describe("ensureOwnerCredential", () => {
  it("keeps a hash that still matches the env password", async () => {
    const store = new InMemoryOwnerCredentialStore("plain:pw-123456");
    await ensureOwnerCredential({ store, hasher: new PlainTextHasher(), ownerPassword: "pw-123456" });
    expect(store.saves).toBe(0);
  });

  it("re-hashes when the env password changed", async () => {
    const store = new InMemoryOwnerCredentialStore("plain:old-password");
    await ensureOwnerCredential({ store, hasher: new PlainTextHasher(), ownerPassword: "new-password" });
    expect(store.hash).toBe("plain:new-password");
  });
});
