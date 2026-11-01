import type { TextExtractor, UploadedFile } from "@/application/ports/text-extractor";

const PLAIN_EXTENSIONS = /\.(md|markdown|txt)$/i;

function isPdf(file: Pick<UploadedFile, "name" | "mimeType">): boolean {
  return file.mimeType === "application/pdf" || /\.pdf$/i.test(file.name);
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  // Loaded lazily: pdf.js is large and only needed for PDF uploads.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

/** Extracts text from PDF, Markdown and plain-text uploads. */
export class DocumentTextExtractor implements TextExtractor {
  supports(file: Pick<UploadedFile, "name" | "mimeType">): boolean {
    return isPdf(file) || PLAIN_EXTENSIONS.test(file.name) || file.mimeType === "text/plain" || file.mimeType === "text/markdown";
  }

  async extract(file: UploadedFile): Promise<string> {
    if (isPdf(file)) return pdfText(file.bytes);
    return new TextDecoder("utf-8").decode(file.bytes);
  }
}
