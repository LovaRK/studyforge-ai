import type { QuizCandidate } from "@/domain/quiz/question";
import type { GeneratedQuizOption, SessionScope } from "@/domain/study/types";
import type { ExcerptView } from "./study";
export interface QuizScope {
  scope: SessionScope;
  value?: string;
}
export interface StoredQuestion {
  id: string;
  itemId: string;
  prompt: string;
  options: GeneratedQuizOption[];
}
export interface QuizAnswer {
  correct: boolean;
  correctIndex: number;
  chosenIndex: number;
  excerpts: ExcerptView[];
}
export class QuizError extends Error {}
export interface QuizStore {
  candidates(scope: QuizScope): Promise<QuizCandidate[]>;
  save(question: Omit<StoredQuestion, "id">): Promise<StoredQuestion>;
  /** Atomically validates approved items, session and index; first answer wins on retries. */
  answer(id: string, chosenIndex: number, sessionId?: string): Promise<QuizAnswer>;
}
