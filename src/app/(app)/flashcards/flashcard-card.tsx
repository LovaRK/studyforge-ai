"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { FlashcardView } from "@/application/flashcards/flashcards";
import { Badge, buttonClass, GeneratedLabel, SourceFactLabel } from "@/components/ui";
import { ITEM_TYPE_LABELS } from "@/domain/items/item";
import { GRADES, type Grade } from "@/domain/study/types";
import { gradeCardAction } from "./actions";

const GRADE_LABELS: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const GRADE_STYLES: Record<Grade, string> = {
  again: "border-danger/40 text-danger",
  hard: "",
  good: "border-accent/40 text-accent",
  easy: "",
};

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

interface Props {
  card: FlashcardView;
  sessionId?: string;
  /** Called after a grade is saved; the default refreshes the page for the next card. */
  onGraded?: () => void;
}

/** One card: question first, then the answer with its source facts and the four SM-2 grades. Space reveals, 1–4 grade. */
export function FlashcardCard({ card, sessionId, onGraded }: Props) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grade = useCallback(
    (value: Grade) => {
      if (pending) return;
      setError(null);
      startTransition(async () => {
        const result = await gradeCardAction({ itemId: card.itemId, grade: value, version: card.version, sessionId });
        if (!result.ok) {
          setError(result.error);
          // In a session the usual cause is that it ended (time, Finish in another tab): show its summary.
          if (sessionId) router.refresh();
          return;
        }
        if (onGraded) onGraded();
        else router.refresh();
      });
    },
    [card.itemId, card.version, onGraded, pending, router, sessionId],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!revealed && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        grade(GRADES[Number(event.key) - 1]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, revealed]);

  return (
    <article
      className="animate-[rise_320ms_ease-out] space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-lg sm:p-6"
      aria-label="Flashcard"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{ITEM_TYPE_LABELS[card.type]}</Badge>
        {card.isNew && <Badge>New</Badge>}
        <Link href={`/library/${card.itemId}`} className="text-xs text-muted hover:text-foreground">
          {card.title}
        </Link>
      </div>

      <div className="space-y-1">
        <GeneratedLabel />
        <h2 className="text-lg font-medium leading-snug">{card.question}</h2>
      </div>

      {!revealed ? (
        <button type="button" className={`${buttonClass.primary} w-full sm:w-auto`} onClick={() => setRevealed(true)} autoFocus>
          Show answer <kbd className="text-xs opacity-70">Space</kbd>
        </button>
      ) : (
        <>
          <section className="animate-[rise_260ms_ease-out] space-y-1 border-t border-line pt-4" aria-label="Answer">
            <GeneratedLabel />
            <p className="whitespace-pre-line leading-relaxed">{card.answer}</p>
          </section>
          <section className="space-y-2" aria-label="Source facts">
            <SourceFactLabel />
            {card.excerpts.map((excerpt, i) => (
              <figure key={i} className="space-y-1">
                <blockquote className="rounded-r-lg border-l-2 border-accent bg-accent/5 py-2 pl-3 pr-2 text-sm leading-relaxed">
                  {excerpt.text}
                </blockquote>
                <figcaption className="pl-3 text-xs text-muted">
                  {excerpt.sourceTitle}
                  {excerpt.sourceAttribution && ` · Source: ${excerpt.sourceAttribution}`}
                </figcaption>
              </figure>
            ))}
          </section>
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-sm text-muted">How well did you know it?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Grade">
              {GRADES.map((value, i) => (
                <button
                  key={value}
                  type="button"
                  disabled={pending}
                  onClick={() => grade(value)}
                  className={`${buttonClass.secondary} flex-col gap-0 py-2 ${GRADE_STYLES[value]}`}
                  aria-label={`${GRADE_LABELS[value]}, next in ${card.waits[value]}`}
                >
                  <span>
                    {GRADE_LABELS[value]} <kbd className="text-xs text-muted">{i + 1}</kbd>
                  </span>
                  <span className="text-xs font-normal text-muted">{card.waits[value]}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
