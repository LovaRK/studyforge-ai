const GLOBAL_KEY = "global";

export type ClientKeyOptions = {
  trustedProxyHops: number;
  verified: boolean;
};

/**
 * Forwarded headers are append-only in the supported deployment, so every value in
 * them can contain client input. Until the server exposes authenticated proxy metadata,
 * use one safe bucket rather than turning a client-supplied address into a key.
 */
export function clientKeyFromForwardedFor(forwarded: string | null, options?: ClientKeyOptions): string {
  void forwarded;
  void options;
  return GLOBAL_KEY;
}
