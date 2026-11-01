/**
 * The word-for-word check. An extracted excerpt is accepted only if it occurs
 * in the source text once both are normalised for differences that don't change
 * the words: whitespace and line breaks, PDF line-break hyphenation, quote and
 * dash style, ligatures, case, and a few formatting marks.
 */

export interface MatchRange {
  /** Inclusive start offset in the original source text. */
  start: number;
  /** Exclusive end offset in the original source text. */
  end: number;
}

type LineBreakHyphen = "join" | "keep";

interface Normalized {
  text: string;
  /** map[i] is the offset in the original text of normalised character i. */
  map: number[];
}

const REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "‛": "'",
  "′": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "‟": '"',
  "″": '"',
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  "ﬀ": "ff",
  "ﬁ": "fi",
  "ﬂ": "fl",
  "ﬃ": "ffi",
  "ﬄ": "ffl",
};

/** Characters dropped on both sides: soft hyphen, markdown code ticks, bullet glyphs. */
const IGNORED = new Set(["­", "`", "●", "•", "▪", "◦", "■"]);

/** Edge punctuation a model may add or drop around a quote. */
const EDGE_PUNCTUATION = /^[\s.,;:!?'"()[\]-]+|[\s.,;:!?'"()[\]-]+$/g;

const LINE_BREAK_HYPHEN = /^-[ \t]*\r?\n\s*/;

export function normalizeWithMap(input: string, lineBreakHyphen: LineBreakHyphen = "keep"): Normalized {
  const chars: string[] = [];
  const map: number[] = [];
  let pendingSpaceAt = -1;

  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;

    if (ch === "-" || ch === "­") {
      const lineBreak = LINE_BREAK_HYPHEN.exec(input.slice(i, i + 40).replace(/^­/, "-"));
      const previous = chars[chars.length - 1];
      if (lineBreak && previous && /\p{L}/u.test(previous) && pendingSpaceAt < 0) {
        if (lineBreakHyphen === "keep" && ch === "-") {
          chars.push("-");
          map.push(i);
        }
        i += lineBreak[0].length;
        continue;
      }
    }

    if (IGNORED.has(ch)) {
      i += 1;
      continue;
    }

    if (/\s/u.test(ch)) {
      if (chars.length > 0 && pendingSpaceAt < 0) pendingSpaceAt = i;
      i += 1;
      continue;
    }

    if (pendingSpaceAt >= 0) {
      chars.push(" ");
      map.push(pendingSpaceAt);
      pendingSpaceAt = -1;
    }

    for (const out of (REPLACEMENTS[ch] ?? ch).toLowerCase()) {
      chars.push(out);
      map.push(i);
    }
    i += 1;
  }

  return { text: chars.join(""), map };
}

/** Normalised form of an excerpt as quoted by a model, without the map. */
export function normalizeExcerpt(excerpt: string): string {
  return normalizeWithMap(excerpt).text.replace(EDGE_PUNCTUATION, "");
}

/**
 * Some PDFs lose ligature glyphs on extraction ("di erences" for "differences").
 * As a last resort, try the excerpt with ligature letter pairs replaced by a space.
 */
function ligatureLossVariant(normalizedExcerpt: string): string {
  return normalizedExcerpt.replace(/ffi|ffl|ff|fi|fl/g, " ").replace(/ {2,}/g, " ");
}

export interface FindExcerptOptions {
  /** Shorter normalised excerpts are rejected as too weak to verify anything. */
  minLength?: number;
}

export function findExcerpt(source: string, excerpt: string, options: FindExcerptOptions = {}): MatchRange | null {
  const needle = normalizeExcerpt(excerpt);
  if (needle.length < (options.minLength ?? 12)) return null;

  const candidates = [needle];
  const variant = ligatureLossVariant(needle);
  if (variant !== needle) candidates.push(variant);

  const haystacks = new Map<LineBreakHyphen, Normalized>();
  for (const candidate of candidates) {
    for (const mode of ["join", "keep"] as const) {
      if (!haystacks.has(mode)) haystacks.set(mode, normalizeWithMap(source, mode));
      const haystack = haystacks.get(mode)!;
      const index = haystack.text.indexOf(candidate);
      if (index >= 0) {
        const start = haystack.map[index]!;
        let end = haystack.map[index + candidate.length - 1]! + 1;
        // Keep the sentence's closing mark when the quote and the source both have it.
        const closing = /[.!?]$/.exec(excerpt.trim())?.[0];
        if (closing && source[end] === closing) end += 1;
        return { start, end };
      }
    }
  }
  return null;
}
