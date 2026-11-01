import type { SourceRecord, SourceStore } from "@/application/ports/study";
import type { TextExtractor, UploadedFile } from "@/application/ports/text-extractor";
import { chunkText, countWords } from "@/domain/text/chunker";
import { UserFacingError } from "@/application/errors";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class SourceImportError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "SourceImportError";
  }
}

/**
 * Canonical stored text. Offsets of chunks and excerpts point into exactly this
 * string, so it is cleaned once here and never changed afterwards.
 */
export function cleanSourceText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function importSource(
  deps: { sources: SourceStore; extractor: TextExtractor; maxWordsPerChunk?: number },
  input: { file: UploadedFile; title?: string; attribution?: string },
): Promise<SourceRecord> {
  const { file } = input;
  if (file.bytes.byteLength === 0) throw new SourceImportError("The file is empty.");
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new SourceImportError("Files must be 10 MB or smaller.");
  if (!deps.extractor.supports(file)) throw new SourceImportError("Upload a PDF, Markdown (.md) or text (.txt) file.");

  const text = cleanSourceText(await deps.extractor.extract(file));
  if (!text) throw new SourceImportError("No text could be extracted from this file. Scanned PDFs need OCR first.");

  const chunks = chunkText(text, { maxWords: deps.maxWordsPerChunk ?? 1500 });
  const title = input.title?.trim() || file.name.replace(/\.[^.]+$/, "");

  return deps.sources.create(
    {
      title,
      attribution: input.attribution?.trim() || null,
      fileName: file.name,
      mimeType: file.mimeType || "application/octet-stream",
      text,
      wordCount: countWords(text),
    },
    chunks.map(({ ordinal, heading, start, end, wordCount }) => ({ ordinal, heading, start, end, wordCount })),
  );
}
