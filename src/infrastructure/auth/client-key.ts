const GLOBAL_KEY = "global";

/**
 * Forwarded headers are append-only in the supported deployment, so every value in
 * them can contain client input. Until the server exposes authenticated proxy metadata,
 * use one safe bucket rather than turning a client-supplied address into a key.
 */
export function globalLoginRateLimitKey(): string {
  return GLOBAL_KEY;
}
