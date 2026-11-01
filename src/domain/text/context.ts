/** Source text around an excerpt, cut at word boundaries. `match` is exactly the excerpt span. */
export interface TextContext {
  before: string;
  match: string;
  after: string;
  truncatedBefore: boolean;
  truncatedAfter: boolean;
}

export function excerptContext(text: string, start: number, end: number, chars: number): TextContext {
  const from = Math.max(0, start - chars);
  const to = Math.min(text.length, end + chars);
  let before = text.slice(from, start);
  let after = text.slice(end, to);
  // Drop the partial word at each cut edge.
  if (from > 0) before = before.replace(/^\S*\s*/, "");
  if (to < text.length) after = after.replace(/\s*\S*$/, "");
  return { before, match: text.slice(start, end), after, truncatedBefore: from > 0, truncatedAfter: to < text.length };
}
