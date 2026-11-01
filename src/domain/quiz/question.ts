import type { GeneratedQuizOption } from "@/domain/study/types";

export interface QuizCandidate {
  id: string;
  question: string;
  answer: string;
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Reuses reviewed wording; never asks a model to invent unreviewed distractors. */
export function buildQuestion(item: QuizCandidate, candidates: QuizCandidate[], random = Math.random) {
  const options: GeneratedQuizOption[] = [{ text: item.answer, correct: true, provenance: "generated", itemId: item.id }];
  const seen = new Set([item.answer.trim().toLowerCase()]);
  // Sample before taking three so every question does not reuse the same
  // earliest-approved distractors.
  for (const other of shuffled(candidates, random)) {
    const key = other.answer.trim().toLowerCase();
    if (other.id === item.id || !key || seen.has(key)) continue;
    seen.add(key);
    options.push({ text: other.answer, correct: false, provenance: "generated", itemId: other.id });
    if (options.length === 4) break;
  }
  if (!item.question.trim() || !item.answer.trim() || options.length < 2) return null;
  const shuffledOptions = shuffled(options, random);
  return { itemId: item.id, prompt: item.question, options: shuffledOptions };
}
