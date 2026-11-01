import { describe, expect, it } from "vitest";
import { findExcerpt, normalizeExcerpt, normalizeWithMap } from "./excerpt-matcher";

const SOURCE = [
  "Copy on write is an optimisation used by Swift collections such as",
  "Array and Dictionary. A copy happens only when one of the shared",
  "values is modi-",
  "fied, so assigning an array is cheap.",
  "",
  "The term “value semantics” means each variable owns its own data — changes",
  "never leak to other copies. Use the copy-",
  "on-write pattern for large custom value types.",
  "Swift’s standard library checks isKnownUniquelyReferenced(_:) first.",
  "● Improves performance by reducing memory allocations.",
  "Use `struct` for small models. The ﬁrst rule: prefer value types.",
].join("\n");

function slice(range: { start: number; end: number } | null) {
  return range ? SOURCE.slice(range.start, range.end) : null;
}

describe("findExcerpt", () => {
  it("finds an exact excerpt and returns its range in the original text", () => {
    const range = findExcerpt(SOURCE, "Copy on write is an optimisation used by Swift collections");
    expect(range?.start).toBe(0);
    expect(slice(range)).toBe("Copy on write is an optimisation used by Swift collections");
  });

  it("ignores line breaks and repeated whitespace", () => {
    const range = findExcerpt(SOURCE, "such as Array   and Dictionary.");
    expect(slice(range)).toBe("such as\nArray and Dictionary.");
  });

  it("only keeps closing punctuation the quote also has", () => {
    expect(slice(findExcerpt(SOURCE, "such as Array and Dictionary"))).toBe("such as\nArray and Dictionary");
  });

  it("joins words hyphenated across a PDF line break", () => {
    expect(slice(findExcerpt(SOURCE, "one of the shared values is modified, so assigning an array is cheap"))).toBe(
      "one of the shared\nvalues is modi-\nfied, so assigning an array is cheap",
    );
  });

  it("keeps real hyphens that happen to fall at a line break", () => {
    expect(findExcerpt(SOURCE, "Use the copy-on-write pattern for large custom value types")).not.toBeNull();
  });

  it("treats smart and straight quotes, and dashes, as equal", () => {
    expect(findExcerpt(SOURCE, 'The term "value semantics" means each variable owns its own data - changes never leak')).not.toBeNull();
    expect(findExcerpt(SOURCE, "Swift's standard library checks isKnownUniquelyReferenced(_:) first")).not.toBeNull();
  });

  it("ignores case, bullets, code ticks and edge punctuation", () => {
    expect(findExcerpt(SOURCE, "improves performance by reducing memory allocations")).not.toBeNull();
    expect(findExcerpt(SOURCE, "Use struct for small models.")).not.toBeNull();
    expect(findExcerpt(SOURCE, '"A copy happens only when one of the shared values"')).not.toBeNull();
  });

  it("matches ligature characters in either text", () => {
    expect(findExcerpt(SOURCE, "The first rule: prefer value types")).not.toBeNull();
  });

  it("accepts a partial sentence that is a real substring", () => {
    expect(slice(findExcerpt(SOURCE, "assigning an array is cheap"))).toBe("assigning an array is cheap");
  });

  it("rejects an excerpt that is only partly in the source", () => {
    expect(findExcerpt(SOURCE, "A copy happens only when one of the shared values is read")).toBeNull();
  });

  it("rejects paraphrases and invented facts", () => {
    expect(findExcerpt(SOURCE, "Copy on write delays copying until a value is mutated.")).toBeNull();
    expect(findExcerpt(SOURCE, "Swift collections are always stored on the heap.")).toBeNull();
  });

  it("rejects excerpts too short to verify anything", () => {
    expect(findExcerpt(SOURCE, "Swift")).toBeNull();
    expect(findExcerpt(SOURCE, "   ")).toBeNull();
  });

  it("recovers PDF text that lost its ligature glyphs", () => {
    const pdfText = "2. Major di erences between structs and classes\nApple O cial guidance";
    expect(findExcerpt(pdfText, "Major differences between structs and classes")).not.toBeNull();
    expect(findExcerpt(pdfText, "Apple Official guidance")).not.toBeNull();
  });
});

describe("normalisation", () => {
  it("maps every normalised character back into the original", () => {
    const { text, map } = normalizeWithMap("A  “quote”\nhere");
    expect(text).toBe('a "quote" here');
    expect(map).toHaveLength(text.length);
    expect(map.every((offset, i) => i === 0 || offset > map[i - 1]!)).toBe(true);
  });

  it("strips edge punctuation from excerpts only", () => {
    expect(normalizeExcerpt('  "Hello, world."  ')).toBe("hello, world");
  });
});
