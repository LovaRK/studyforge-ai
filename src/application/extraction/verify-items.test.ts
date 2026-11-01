import { describe, expect, it } from "vitest";
import { verifyExtractedItems } from "./verify-items";

const source = { id: "s1", text: "Intro line.\nStructs are value types in Swift.\nClasses are reference types in Swift." };
const chunk = { start: source.text.indexOf("Classes"), end: source.text.length };

const item = (excerpt: string, title = "T") => ({ type: "concept" as const, title, summary: "s", question: "q", answer: "a", excerpt, tags: [" Swift Basics "] });

describe("verifyExtractedItems", () => {
  it("accepts excerpts in the chunk with absolute offsets and the verbatim source text", () => {
    const { verified, rejected } = verifyExtractedItems([item("classes are reference types in swift")], source, chunk);
    expect(rejected).toEqual([]);
    expect(verified[0]!.excerpt).toEqual({ sourceId: "s1", text: "Classes are reference types in Swift", start: chunk.start, end: chunk.start + 36 });
    expect(verified[0]!.tags).toEqual(["swift-basics"]);
  });

  it("falls back to the whole source for excerpts outside the chunk", () => {
    const { verified } = verifyExtractedItems([item("Structs are value types in Swift.")], source, chunk);
    expect(source.text.slice(verified[0]!.excerpt.start, verified[0]!.excerpt.end)).toBe("Structs are value types in Swift.");
  });

  it("rejects excerpts that are not in the source", () => {
    const { verified, rejected } = verifyExtractedItems([item("Structs are always faster than classes.", "Speed")], source, chunk);
    expect(verified).toEqual([]);
    expect(rejected).toEqual([{ type: "concept", title: "Speed", excerpt: "Structs are always faster than classes.", reason: "excerpt_not_found" }]);
  });

  it("drops exact duplicates from one response", () => {
    const { verified } = verifyExtractedItems([item("Classes are reference types"), item("Classes are reference types.")], source, chunk);
    expect(verified).toHaveLength(1);
  });
});
