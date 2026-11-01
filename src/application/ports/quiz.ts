import type { QuizCandidate } from "@/domain/quiz/question";
import type { GeneratedQuizOption } from "@/domain/study/types";
import { UserFacingError } from "@/application/errors";
import type { StudyScope } from "./flashcards";
import type { ExcerptView } from "./study";

export type QuizScope = StudyScope;
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
export class QuizError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "QuizError";
  }
}
export interface QuizStore {
  candidates(scope: QuizScope): Promise<QuizCandidate[]>;
  save(question: Omit<StoredQuestion, "id">): Promise<StoredQuestion>;
  /** Atomically validates approved items, session and index; first answer wins on retries. */
  answer(id: string, chosenIndex: number, sessionId?: string): Promise<QuizAnswer>;
}
