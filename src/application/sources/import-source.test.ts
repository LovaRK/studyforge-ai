import { describe, expect, it } from "vitest";
import type { TextExtractor } from "@/application/ports/text-extractor";
import { InMemoryStudyDb } from "@/test/study-fakes";
import { cleanSourceText, importSource, MAX_UPLOAD_BYTES, SourceImportError } from "./import-source";

const textExtractor: TextExtractor = {
  supports: (file) => /\.(txt|md)$/.test(file.name),
  extract: async (file) => new TextDecoder().decode(file.bytes),
};

const file = (text: string, name = "notes.md") => ({ name, mimeType: "text/markdown", bytes: new TextEncoder().encode(text) });

describe("importSource", () => {
  it("stores cleaned text with chunks whose offsets point into it", async () => {
    const db = new InMemoryStudyDb();
    const source = await importSource(
      { sources: db, extractor: textExtractor, maxWordsPerChunk: 8 },
      { file: file("# A\r\none two three four\r\n\r\n\r\n# B\nfive six seven eight") },
    );

    expect(source.title).toBe("notes");
    expect(source.text).toBe("# A\none two three four\n\n# B\nfive six seven eight");
    expect(db.chunks).toHaveLength(2);
    expect(db.chunks.map((c) => source.text.slice(c.start, c.end))).toEqual(["# A\none two three four", "# B\nfive six seven eight"]);
  });

  it("keeps the given title and attribution", async () => {
    const db = new InMemoryStudyDb();
    const source = await importSource(
      { sources: db, extractor: textExtractor },
      { file: file("Some notes here."), title: " Swift ", attribution: "Intern Labs" },
    );
    expect(source).toMatchObject({ title: "Swift", attribution: "Intern Labs" });
  });

  it("rejects empty, oversized, unsupported and textless files", async () => {
    const deps = { sources: new InMemoryStudyDb(), extractor: textExtractor };
    await expect(importSource(deps, { file: file("") })).rejects.toThrow("empty");
    await expect(importSource(deps, { file: { ...file("x"), bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1) } })).rejects.toThrow("10 MB");
    await expect(importSource(deps, { file: file("hello", "slides.pptx") })).rejects.toBeInstanceOf(SourceImportError);
    await expect(importSource(deps, { file: file(" \n\n ") })).rejects.toThrow("No text");
  });
});

describe("cleanSourceText", () => {
  it("normalises line endings, trailing spaces and blank runs", () => {
    expect(cleanSourceText("a  \r\nb\u0000\n\n\n\nc ")).toBe("a\nb\n\nc");
  });
});
