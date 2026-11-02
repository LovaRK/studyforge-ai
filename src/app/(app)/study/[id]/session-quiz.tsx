"use client";

import { useRouter } from "next/navigation";
import type { QuizQuestionView } from "@/application/quiz/quiz";
import { QuizCard } from "../../quiz/quiz-card";

/** A quiz question inside a session: answers count toward it, and "Next" asks the session for its next step. */
export function SessionQuiz({ question, sessionId }: { question: QuizQuestionView; sessionId: string }) {
  const router = useRouter();
  return <QuizCard initial={question} sessionId={sessionId} onNext={() => router.refresh()} />;
}
