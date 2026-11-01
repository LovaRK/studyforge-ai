import { describe, expect, it } from "vitest";
import { chunkText, countWords } from "./chunker";

const words = (n: number, word = "word") => Array.from({ length: n }, () => word).join(" ");

describe("chunkText", () => {
  it("keeps a short text as one trimmed chunk", () => {
    const text = "\n\n# Title\nSome text here.\n\n";
    const [chunk, ...rest] = chunkText(text);
    expect(rest).toHaveLength(0);
    expect(chunk).toMatchObject({ ordinal: 0, text: "# Title\nSome text here.", heading: "# Title", wordCount: 5 });
  });

  it("always slices exactly from the source", () => {
    const text = `Q: first?\n${words(80)}\n\nQ: second?\n${words(80)}\n`;
    for (const chunk of chunkText(text, { maxWords: 60 })) {
      expect(text.slice(chunk.start, chunk.end)).toBe(chunk.text);
    }
  });

  it("starts new chunks at Q&A questions when the limit is reached", () => {
    const text = `Q: What is ARC?\n${words(40)}\nQ: What is a retain cycle?\n${words(40)}\nQ: What is weak?\n${words(10)}`;
    const chunks = chunkText(text, { maxWords: 60 });
    expect(chunks.map((c) => c.heading)).toEqual(["Q: What is ARC?", "Q: What is a retain cycle?"]);
    expect(chunks[1]!.text).toContain("Q: What is weak?");
  });

  it("splits an oversized section at numbered points, then at lines", () => {
    const text = `Q: Big answer?\n1. ${words(50)}\n2. ${words(50)}\n3. ${words(50)}`;
    const chunks = chunkText(text, { maxWords: 70 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every((c) => c.wordCount <= 70)).toBe(true);
    expect(chunks[1]!.text.startsWith("2.")).toBe(true);
  });

  it("covers every word of the source exactly once", () => {
    const text = `# A\n${words(30, "alpha")}\n## B\n${words(45, "beta")}\nQ: C?\n${words(25, "gamma")}`;
    const chunks = chunkText(text, { maxWords: 40 });
    expect(chunks.reduce((sum, c) => sum + c.wordCount, 0)).toBe(countWords(text));
    chunks.slice(1).forEach((c, i) => expect(c.start).toBeGreaterThanOrEqual(chunks[i]!.end));
  });

  it("splits a single line longer than the limit between words (#3)", () => {
    const text = "word ".repeat(5000);
    const chunks = chunkText(text);
    expect(chunks.map((c) => c.wordCount)).toEqual([1500, 1500, 1500, 500]);
    expect(chunks.every((c) => text.slice(c.start, c.end) === c.text)).toBe(true);
  });

  it("prefers a sentence end near the limit when splitting a long line", () => {
    const sentence = (n: number) => `${words(n - 1)} end.`;
    const text = `${sentence(45)} ${sentence(45)} ${sentence(20)}`; // one line, 110 words
    const chunks = chunkText(text, { maxWords: 100 });
    expect(chunks.map((c) => c.wordCount)).toEqual([90, 20]);
    expect(chunks[0]!.text.endsWith("end.")).toBe(true);
  });

  it("never loses or duplicates words when splitting long lines", () => {
    const text = `Q: Long?\n${words(333, "alpha")}\n${words(7)}\n${words(250, "beta")}`;
    const chunks = chunkText(text, { maxWords: 100 });
    expect(chunks.every((c) => c.wordCount <= 100)).toBe(true);
    expect(chunks.reduce((sum, c) => sum + c.wordCount, 0)).toBe(countWords(text));
    chunks.slice(1).forEach((c, i) => expect(c.start).toBeGreaterThanOrEqual(chunks[i]!.end));
  });

  it("returns nothing for blank text", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });
});
