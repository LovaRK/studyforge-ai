import type { LoginRateLimiter, RateLimitDecision } from "@/application/ports/auth";

/**
 * Fixed-window limiter for failed logins, kept in memory. Enough for a
 * single-owner app on one instance; resets when the server restarts.
 */
export class MemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly failures = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly options: { maxFailures: number; windowSeconds: number } = { maxFailures: 5, windowSeconds: 15 * 60 }) {}

  tryAcquire(clientKey: string, now: Date): RateLimitDecision {
    const entry = this.current(clientKey, now) ?? { count: 0, windowStart: now.getTime() };
    if (entry.count >= this.options.maxFailures) {
      const retryAfterMs = entry.windowStart + this.options.windowSeconds * 1000 - now.getTime();
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }
    entry.count += 1;
    this.failures.set(clientKey, entry);
    return { allowed: true };
  }

  /** @deprecated Use tryAcquire so the limit is enforced before async password work. */
  check(clientKey: string, now: Date): RateLimitDecision {
    const entry = this.current(clientKey, now);
    if (!entry || entry.count < this.options.maxFailures) return { allowed: true };
    const retryAfterMs = entry.windowStart + this.options.windowSeconds * 1000 - now.getTime();
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  reset(clientKey: string): void {
    this.failures.delete(clientKey);
  }

  private current(clientKey: string, now: Date) {
    const entry = this.failures.get(clientKey);
    if (entry && now.getTime() - entry.windowStart >= this.options.windowSeconds * 1000) {
      this.failures.delete(clientKey);
      return undefined;
    }
    return entry;
  }
}
