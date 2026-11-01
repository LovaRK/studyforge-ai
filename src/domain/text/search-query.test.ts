import { describe, expect, it } from "vitest";
import { MAX_SEARCH_LENGTH, toPrefixTsQuery } from "./search-query";

describe("toPrefixTsQuery", () => {
  it("requires every word and lets each one be a prefix", () => {
    expect(toPrefixTsQuery("Grand central")).toBe("grand:* & central:*");
  });

  it("drops punctuation and tsquery operators so input cannot change the query", () => {
    expect(toPrefixTsQuery("a & !b | (c) <-> d:* 'e'")).toBe("a:* & b:* & c:* & d:* & e:*");
    expect(toPrefixTsQuery("memory-management")).toBe("memory:* & management:*");
  });

  it("keeps letters and digits from any script", () => {
    expect(toPrefixTsQuery("Café über 3D")).toBe("café:* & über:* & 3d:*");
  });

  it("removes repeated words and caps the number of terms", () => {
    expect(toPrefixTsQuery("queue queue Queue")).toBe("queue:*");
    expect(toPrefixTsQuery("a b c d e f g h i j")!.split(" & ")).toHaveLength(8);
  });

  it("ignores text beyond the maximum length", () => {
    expect(toPrefixTsQuery(`${"x".repeat(MAX_SEARCH_LENGTH)} hidden`)).toBe(`${"x".repeat(MAX_SEARCH_LENGTH)}:*`);
  });

  it("returns null when nothing searchable is left", () => {
    expect(toPrefixTsQuery("")).toBeNull();
    expect(toPrefixTsQuery("  -- && ")).toBeNull();
  });
});
