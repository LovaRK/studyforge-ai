import type { RejectedItem, VerifiedItem } from "@/application/ports/study";
import { normalizeTags } from "@/domain/items/item";
import { findExcerpt } from "@/domain/text/excerpt-matcher";
import type { ExtractedItem } from "./prompt";

/**
 * Applies the word-for-word check to model output. Each excerpt is looked up
 * in its chunk first, then anywhere in the source. Items whose excerpt is not
 * found are rejected and never reach the review queue.
 */
export function verifyExtractedItems(
  extracted: ExtractedItem[],
  source: { id: string; text: string },
  chunk: { start: number; end: number },
): { verified: VerifiedItem[]; rejected: RejectedItem[] } {
  const chunkText = source.text.slice(chunk.start, chunk.end);
  const verified: VerifiedItem[] = [];
  const rejected: RejectedItem[] = [];
  const seen = new Set<string>();

  for (const item of extracted) {
    const inChunk = findExcerpt(chunkText, item.excerpt);
    const range = inChunk ? { start: inChunk.start + chunk.start, end: inChunk.end + chunk.start } : findExcerpt(source.text, item.excerpt);

    if (!range) {
      rejected.push({ type: item.type, title: item.title, excerpt: item.excerpt, reason: "excerpt_not_found" });
      continue;
    }

    const key = `${item.title.toLowerCase()}|${range.start}|${range.end}`;
    if (seen.has(key)) continue;
    seen.add(key);

    verified.push({
      type: item.type,
      title: item.title,
      summary: item.summary,
      question: item.question,
      answer: item.answer,
      tags: normalizeTags(item.tags),
      excerpt: { sourceId: source.id, text: source.text.slice(range.start, range.end), ...range },
    });
  }

  return { verified, rejected };
}
