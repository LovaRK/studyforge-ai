export const ITEM_TYPES = ["concept", "term", "system", "process", "how_to", "question"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  concept: "Concept",
  term: "Term",
  system: "System",
  process: "Process",
  how_to: "How-to",
  question: "Question to investigate",
};

export const ITEM_STATUSES = ["pending", "approved", "discarded", "merged"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REVIEW_ACTIONS = ["approve", "edit", "merge", "tag", "discard"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** A verbatim span of a source: the "source fact" behind an item. */
export interface Excerpt {
  sourceId: string;
  /** Exactly `source.text.slice(start, end)`. */
  text: string;
  start: number;
  end: number;
}

/** The model's wording. Always shown as generated interpretation, never as fact. */
export interface GeneratedFields {
  type: ItemType;
  title: string;
  summary: string;
  question: string;
  answer: string;
}

/** Lower-case, trimmed, de-duplicated tags. */
export function normalizeTags(tags: readonly string[]): string[] {
  const cleaned = tags.map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-")).filter((tag) => tag.length > 0 && tag.length <= 40);
  return [...new Set(cleaned)].slice(0, 12);
}
