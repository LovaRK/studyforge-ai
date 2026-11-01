import { describe, expect, it } from "vitest";
import { isVerbatimSourceOption, type SourceQuizOption } from "./types";

const sourceText = "Structs are value types. Classes are reference types.";

const option = (text: string, start: number, end: number): SourceQuizOption => ({
  provenance: "source",
  text,
  correct: false,
  itemId: "item-1",
  excerpt: { sourceId: "s", start, end },
});

describe("isVerbatimSourceOption", () => {
  it("accepts text that is exactly the referenced excerpt", () => {
    expect(isVerbatimSourceOption(option("Classes are reference types.", 25, 53), sourceText)).toBe(true);
  });

  it("rejects paraphrased or misaligned text, even if similar", () => {
    expect(isVerbatimSourceOption(option("Classes are reference-types.", 25, 53), sourceText)).toBe(false);
    expect(isVerbatimSourceOption(option("Classes are reference types.", 24, 52), sourceText)).toBe(false);
  });
});
