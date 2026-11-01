import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { DocumentTextExtractor } from "./document-text-extractor";

const extractor = new DocumentTextExtractor();

async function makePdf(pages: string[][]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = pdf.addPage([400, 400]);
    lines.forEach((line, i) => page.drawText(line, { x: 40, y: 340 - i * 20, size: 12, font }));
  }
  return pdf.save();
}

describe("DocumentTextExtractor", () => {
  it("supports PDF, Markdown and text files only", () => {
    expect(extractor.supports({ name: "a.pdf", mimeType: "" })).toBe(true);
    expect(extractor.supports({ name: "a.md", mimeType: "" })).toBe(true);
    expect(extractor.supports({ name: "a.txt", mimeType: "text/plain" })).toBe(true);
    expect(extractor.supports({ name: "a.docx", mimeType: "application/octet-stream" })).toBe(false);
  });

  it("reads UTF-8 text files as-is", async () => {
    const text = "Swift’s value types — copied on write.";
    expect(await extractor.extract({ name: "a.md", mimeType: "text/markdown", bytes: new TextEncoder().encode(text) })).toBe(text);
  });

  it("extracts text from every page of a PDF without page markers", async () => {
    const bytes = await makePdf([["Structs are value types."], ["Classes are reference types."]]);
    const text = await extractor.extract({ name: "notes.pdf", mimeType: "application/pdf", bytes });

    expect(text).toContain("Structs are value types.");
    expect(text).toContain("Classes are reference types.");
    expect(text).not.toMatch(/-- \d+ of \d+ --/);
  });
});
