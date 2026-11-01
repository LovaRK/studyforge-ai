export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, storedHash: string): Promise<boolean>;
}

/** Stores the single owner's password hash. */
export interface OwnerCredentialStore {
  getHash(): Promise<string | null>;
  saveHash(hash: string): Promise<void>;
}

export interface SessionIssuer {
  issue(now: Date): { token: string; expiresAt: Date };
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface LoginRateLimiter {
  check(clientKey: string, now: Date): RateLimitDecision;
  recordFailure(clientKey: string, now: Date): void;
  reset(clientKey: string): void;
}
