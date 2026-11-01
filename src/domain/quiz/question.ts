import type { GeneratedQuizOption } from "@/domain/study/types";

export interface QuizCandidate {
  id: string;
  question: string;
  answer: string;
}
/** Reuses reviewed wording; never asks a model to invent unreviewed distractors. */
export function buildQuestion(item: QuizCandidate, candidates: QuizCandidate[], random = Math.random) {
  const options: GeneratedQuizOption[] = [{ text: item.answer, correct: true, provenance: "generated", itemId: item.id }];
  const seen = new Set([item.answer.trim().toLowerCase()]);
  for (const other of candidates) {
    const key = other.answer.trim().toLowerCase();
    if (other.id === item.id || !key || seen.has(key)) continue;
    seen.add(key);
    options.push({ text: other.answer, correct: false, provenance: "generated", itemId: other.id });
    if (options.length === 4) break;
  }
  if (!item.question.trim() || !item.answer.trim() || options.length < 2) return null;
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return { itemId: item.id, prompt: item.question, options };
}
