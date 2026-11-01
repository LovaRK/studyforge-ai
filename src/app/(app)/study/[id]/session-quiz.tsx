"use client";

import { useRouter } from "next/navigation";
import type { QuizScope } from "@/application/ports/quiz";
import type { QuizQuestionView } from "@/application/quiz/quiz";
import { QuizCard } from "../../quiz/quiz-card";

/** A quiz question inside a session: answers count toward it, and "Next" asks the session for its next step. */
export function SessionQuiz({ question, scope, sessionId }: { question: QuizQuestionView; scope: QuizScope; sessionId: string }) {
  const router = useRouter();
  return <QuizCard initial={question} scope={scope} sessionId={sessionId} onNext={() => router.refresh()} />;
}
