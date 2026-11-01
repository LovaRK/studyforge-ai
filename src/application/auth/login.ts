import type { LoginRateLimiter, OwnerCredentialStore, PasswordHasher, SessionIssuer } from "@/application/ports/auth";
import { ensureOwnerCredential } from "./owner-credential";

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid_credentials" }
  | { ok: false; reason: "rate_limited"; retryAfterSeconds: number };

export interface LoginDeps {
  store: OwnerCredentialStore;
  hasher: PasswordHasher;
  sessions: SessionIssuer;
  limiter: LoginRateLimiter;
  ownerPassword: string;
  now?: () => Date;
}

export function makeLogin(deps: LoginDeps) {
  const now = deps.now ?? (() => new Date());

  return async function login(input: { password: string; clientKey: string }): Promise<LoginResult> {
    const at = now();
    const decision = deps.limiter.check(input.clientKey, at);
    if (!decision.allowed) return { ok: false, reason: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds };

    const hash = (await deps.store.getHash()) ?? (await ensureOwnerCredential(deps));
    if (!(await deps.hasher.verify(input.password, hash))) {
      deps.limiter.recordFailure(input.clientKey, at);
      return { ok: false, reason: "invalid_credentials" };
    }

    deps.limiter.reset(input.clientKey);
    return { ok: true, ...deps.sessions.issue(at) };
  };
}
