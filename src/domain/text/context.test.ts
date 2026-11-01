import { describe, expect, it } from "vitest";
import { excerptContext } from "./context";

const TEXT = "Alpha bravo charlie delta echo foxtrot golf hotel india.";

describe("excerptContext", () => {
  it("returns the exact span with whole words around it", () => {
    const start = TEXT.indexOf("delta");
    const ctx = excerptContext(TEXT, start, start + "delta echo".length, 10);
    expect(ctx).toEqual({ before: "charlie ", match: "delta echo", after: " foxtrot", truncatedBefore: true, truncatedAfter: true });
  });

  it("keeps the text up to the edges when the window reaches them", () => {
    const ctx = excerptContext(TEXT, 6, 11, 100);
    expect(ctx).toMatchObject({ before: "Alpha ", match: "bravo", truncatedBefore: false, truncatedAfter: false });
    expect(ctx.before + ctx.match + ctx.after).toBe(TEXT);
  });
});
