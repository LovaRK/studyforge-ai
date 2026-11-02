import { isIP } from "node:net";

const GLOBAL_KEY = "global";

export type ClientKeyOptions = {
  trustedProxyHops: number;
  verified: boolean;
};

/**
 * Resolve a rate-limit key only when the deployment has explicitly verified its proxy
 * behavior. With no verified proxy, forwarding headers are client-controlled and all
 * attempts use one safe bucket instead of allowing spoofed keys.
 */
export function clientKeyFromForwardedFor(
  forwarded: string | null,
  options: ClientKeyOptions = { trustedProxyHops: 0, verified: false },
): string {
  if (!options.verified || options.trustedProxyHops < 1 || !forwarded) return GLOBAL_KEY;

  const addresses = forwarded
    .split(",")
    .map((part) => normalizeAddress(part.trim()))
    .filter((part): part is string => part !== null);
  if (addresses.length !== options.trustedProxyHops + 1) return GLOBAL_KEY;

  // The client address is immediately to the left of the verified proxy chain.
  return addresses[addresses.length - options.trustedProxyHops - 1] ?? GLOBAL_KEY;
}

function normalizeAddress(value: string): string | null {
  const unwrapped = value.startsWith("[") && value.includes("]") ? value.slice(1, value.indexOf("]")) : value;
  const withoutPort = isIP(unwrapped) ? unwrapped : value.lastIndexOf(":") > 0 ? value.slice(0, value.lastIndexOf(":")) : value;
  if (!isIP(withoutPort)) return null;
  return isIP(withoutPort) === 6 ? withoutPort.toLowerCase() : withoutPort;
}
