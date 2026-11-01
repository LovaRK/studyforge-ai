import { z } from "zod";
import { ITEM_TYPES } from "@/domain/items/item";

/** Bump when the prompt or schema changes, so cached responses are not reused. */
export const EXTRACTION_PROMPT_VERSION = "extract-v1";

export const extractedItemSchema = z.object({
  type: z.enum(ITEM_TYPES),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(2000),
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().min(1).max(2000),
  excerpt: z.string().trim().min(1).max(2000),
  tags: z.array(z.string()).max(6).default([]),
});

export const extractionResponseSchema = z.object({ items: z.array(extractedItemSchema).max(40) });

export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export const EXTRACTION_SYSTEM_PROMPT = `You turn study notes into study items. You only use what the notes say.

For the text inside <source_text>, extract one item per distinct idea worth studying, usually between 4 and 12. Each item has a type:
- concept: an idea the notes explain
- term: a word or name the notes define
- system: a component, framework or architecture the notes describe
- process: how something works, step by step
- how_to: instructions for doing a task
- question: an open question the notes raise or leave unanswered, worth investigating

For every item return:
- excerpt: one to three consecutive sentences copied WORD FOR WORD from <source_text> that support the item. Copy the characters exactly. Do not fix typos, do not shorten with "...", do not paraphrase, do not combine separate passages. Prefer prose over code.
- title: a short name for the item
- summary: one to three sentences explaining the item, using only facts in the source text
- question: a flashcard question answerable from the excerpt
- answer: the flashcard answer, using only facts in the source text
- tags: up to three short lowercase topic tags

Never add facts, numbers, names or examples that are not in the source text. If the text has nothing worth studying, return no items.
Return JSON: {"items": [{"type", "title", "summary", "question", "answer", "excerpt", "tags"}]}. Return at most 12 items.`;

export function buildExtractionPrompt(input: { sourceTitle: string; chunkText: string }): string {
  return `Source title: ${input.sourceTitle}\n\n<source_text>\n${input.chunkText}\n</source_text>`;
}

/** Recovers the chunk text from a prompt built by buildExtractionPrompt (used by the mock provider). */
export function sourceTextFromPrompt(prompt: string): string {
  const match = /<source_text>\n([\s\S]*)\n<\/source_text>/.exec(prompt);
  return match?.[1] ?? "";
}
