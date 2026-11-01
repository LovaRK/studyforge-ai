/** Longest search box input we look at, and how many words we keep from it. */
export const MAX_SEARCH_LENGTH = 200;
const MAX_TERMS = 8;

/**
 * Turns what the owner typed into a Postgres `to_tsquery` expression in which
 * every word must match and every word may be a prefix ("concur" finds
 * "concurrency"). Only letters and digits survive, so the result can never
 * carry tsquery operators. Returns null when nothing searchable is left.
 */
export function toPrefixTsQuery(input: string): string | null {
  const terms = [
    ...new Set(
      input
        .slice(0, MAX_SEARCH_LENGTH)
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean),
    ),
  ].slice(0, MAX_TERMS);
  return terms.length > 0 ? terms.map((term) => `${term}:*`).join(" & ") : null;
}
