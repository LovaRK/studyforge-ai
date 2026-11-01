"use client";
import { useState, useTransition } from "react";
import type { QuizAnswer, QuizScope } from "@/application/ports/quiz";
import type { QuizQuestionView } from "@/application/quiz/quiz";
import { buttonClass, EmptyState, GeneratedLabel, SourceFactLabel } from "@/components/ui";
import { answerQuizAction, nextQuizAction } from "./actions";
/** On its own page the card fetches the next question for `scope`; in a session, `onNext` asks the session instead. */
export function QuizCard({
  initial,
  scope,
  sessionId,
  onNext,
}: {
  initial: QuizQuestionView | null;
  sessionId?: string;
} & ({ scope: QuizScope; onNext?: undefined } | { scope?: undefined; onNext: () => void })) {
  const [question, setQuestion] = useState(initial);
  const [feedback, setFeedback] = useState<QuizAnswer | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function answer(index: number) {
    if (!question || pending || feedback) return;
    startTransition(async () => {
      setError("");
      const response = await answerQuizAction({ id: question.id, index, sessionId });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setFeedback(response.result);
      setScore((s) => ({ correct: s.correct + Number(response.result.correct), total: s.total + 1 }));
    });
  }
  function next(restart = false) {
    if (onNext) {
      onNext();
      return;
    }
    startTransition(async () => {
      setError("");
      const exclude = restart ? [] : [...seen, ...(question ? [question.itemId] : [])];
      const response = await nextQuizAction(scope, exclude);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setSeen(exclude);
      setQuestion(response.question);
      setFeedback(null);
      if (restart) setScore({ correct: 0, total: 0 });
    });
  }
  return (
    <div className="space-y-4">
      {!sessionId && (
        <p role="status" className="text-sm text-muted">
          This round: {score.correct} / {score.total} correct
        </p>
      )}
      {question ? (
        <article aria-label="Quiz question" className="space-y-5 rounded-xl border border-line bg-surface p-5">
          <GeneratedLabel />
          <h2 className="text-lg font-medium">{question.prompt}</h2>
          <p className="text-sm text-muted">
            Choose the answer approved for this question. Options reuse reviewed wording; they are not additional source facts.
          </p>
          <div className="grid gap-2" role="group" aria-label="Answers">
            {question.options.map((option, index) => (
              <button
                key={index}
                type="button"
                disabled={pending || !!feedback}
                onClick={() => answer(index)}
                className={`${buttonClass.secondary} justify-start whitespace-pre-wrap break-words p-3 text-left ${feedback?.correctIndex === index ? "border-accent" : ""}`}
              >
                <span>
                  <span className="block text-xs text-muted">
                    Generated interpretation{feedback?.correctIndex === index ? " · Correct answer" : ""}
                    {feedback?.chosenIndex === index ? " · Your choice" : ""}
                  </span>
                  {option.text}
                </span>
              </button>
            ))}
          </div>
          {feedback && (
            <section aria-label="Answer feedback" className="space-y-3 border-t border-line pt-4">
              <p role="status" className="font-semibold">
                {feedback.correct ? "Correct" : "Not quite"}
              </p>
              <SourceFactLabel />
              {feedback.excerpts.map((e, i) => (
                <figure key={i}>
                  <blockquote className="whitespace-pre-wrap border-l-2 border-accent pl-3">{e.text}</blockquote>
                  <figcaption className="mt-1 text-xs text-muted">
                    {e.sourceTitle}
                    {e.sourceAttribution && ` · ${e.sourceAttribution}`}
                  </figcaption>
                </figure>
              ))}
              <button type="button" className={buttonClass.primary} disabled={pending} onClick={() => next()}>
                Next question
              </button>
            </section>
          )}
        </article>
      ) : (
        <EmptyState title={score.total ? "Round complete" : "Not enough approved answers"}>
          <p>
            {score.total
              ? "You have studied every available question in this selection."
              : "Approve at least two items with distinct answers in this selection."}
          </p>
          {score.total > 0 && (
            <button type="button" className={`${buttonClass.primary} mt-3`} disabled={pending} onClick={() => next(true)}>
              Start another round
            </button>
          )}
        </EmptyState>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {error && onNext && !feedback && (
        // A refused answer (the session ended, or another tab studied this item) won't succeed on retry.
        <button type="button" className={buttonClass.secondary} disabled={pending} onClick={() => next()}>
          Continue
        </button>
      )}
    </div>
  );
}
