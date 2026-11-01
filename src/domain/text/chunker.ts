/**
 * Splits source text into chunks of about `maxWords` for extraction.
 * Chunks never overlap and always satisfy `text === source.slice(start, end)`,
 * so offsets found inside a chunk map straight back to the source.
 */

export interface TextChunk {
  ordinal: number;
  start: number;
  end: number;
  text: string;
  heading: string | null;
  wordCount: number;
}

/** Section starts: markdown headings and Q&A questions. */
const STRONG_BOUNDARY = /^[ \t]*(#{1,6}[ \t]+\S|Q\d*[ \t]*[:.)][ \t]*\S|Question[ \t]*\d*[ \t]*[:.)])/i;
/** Places to cut an oversized section: numbered points and blank lines. */
const WEAK_BOUNDARY = /^[ \t]*(\d{1,3}[.)][ \t]+\S|$)/;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n" && i + 1 < text.length) starts.push(i + 1);
  return starts;
}

function lineAt(text: string, start: number): string {
  const end = text.indexOf("\n", start);
  return text.slice(start, end < 0 ? text.length : end);
}

/** Splits [start, end) at line starts matching `pattern`. */
function splitAt(text: string, start: number, end: number, starts: number[], pattern: RegExp): [number, number][] {
  const cuts = starts.filter((s) => s > start && s < end && pattern.test(lineAt(text, s)));
  const bounds = [start, ...cuts, end];
  return bounds.slice(0, -1).map((s, i) => [s, bounds[i + 1]!]);
}

/**
 * Last resort for a single line longer than maxWords: cut between words,
 * preferring a sentence end in the last fifth of each window.
 */
function splitWords(text: string, [start, end]: [number, number], maxWords: number): [number, number][] {
  const words = [...text.slice(start, end).matchAll(/\S+/g)].map((m) => ({ at: start + m.index, word: m[0] }));
  if (words.length <= maxWords) return [[start, end]];

  const spans: [number, number][] = [];
  let first = 0;
  while (words.length - first > maxWords) {
    let cut = first + maxWords;
    for (let j = cut; j > first + Math.floor(maxWords * 0.8); j--) {
      if (/[.!?]["')\]]*$/.test(words[j - 1]!.word)) {
        cut = j;
        break;
      }
    }
    spans.push([spans.length === 0 ? start : words[first]!.at, words[cut]!.at]);
    first = cut;
  }
  spans.push([spans.length === 0 ? start : words[first]!.at, end]);
  return spans;
}

/** Greedily packs consecutive spans into groups of at most maxWords. */
function pack(text: string, spans: [number, number][], maxWords: number): [number, number][] {
  const groups: [number, number][] = [];
  let current: [number, number] | null = null;
  let words = 0;
  for (const [s, e] of spans) {
    const w = countWords(text.slice(s, e));
    if (current && words + w <= maxWords) {
      current[1] = e;
      words += w;
    } else {
      if (current) groups.push(current);
      current = [s, e];
      words = w;
    }
  }
  if (current) groups.push(current);
  return groups;
}

export function chunkText(text: string, options: { maxWords?: number } = {}): TextChunk[] {
  const maxWords = options.maxWords ?? 1500;
  const starts = lineStarts(text);

  const spans: [number, number][] = [];
  for (const section of splitAt(text, 0, text.length, starts, STRONG_BOUNDARY)) {
    if (countWords(text.slice(...section)) <= maxWords) {
      spans.push(section);
      continue;
    }
    // Oversized section: cut at numbered points or blank lines, then at any line,
    // then between words inside a line that is still too long.
    for (const part of pack(text, splitAt(text, ...section, starts, WEAK_BOUNDARY), maxWords)) {
      const lines = splitAt(text, ...part, starts, /^/).flatMap((line) => splitWords(text, line, maxWords));
      spans.push(...(countWords(text.slice(...part)) <= maxWords ? [part] : pack(text, lines, maxWords)));
    }
  }

  return pack(text, spans, maxWords)
    .map(([s, e]) => {
      // Trim surrounding whitespace while keeping offsets exact.
      const raw = text.slice(s, e);
      const lead = raw.length - raw.trimStart().length;
      const trail = raw.length - raw.trimEnd().length;
      return [s + lead, e - trail] as const;
    })
    .filter(([s, e]) => e > s)
    .map(([start, end], ordinal) => {
      const chunk = text.slice(start, end);
      const heading = chunk.split("\n", 1)[0]!.trim().slice(0, 120) || null;
      return { ordinal, start, end, text: chunk, heading, wordCount: countWords(chunk) };
    });
}
