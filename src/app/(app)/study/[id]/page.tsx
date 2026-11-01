import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isUserFacingError } from "@/application/errors";
import type { SessionSummary } from "@/application/study-session/study-session";
import { buttonClass } from "@/components/ui";
import { GRADES } from "@/domain/study/types";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { FlashcardCard } from "../../flashcards/flashcard-card";
import { finishSessionAction } from "../actions";
import { Countdown } from "./countdown";

export const metadata: Metadata = { title: "Study session · StudyForge AI" };

const DONE_TITLES = { time: "Time's up", finished: "Session finished", empty: "Nothing left to study here" } as const;

export default async function StudySessionPage({ params }: PageProps<"/study/[id]">) {
  await requireOwner();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const c = container();
  const step = await c.studySessions.next(id).catch((error: unknown) => {
    // The only user-facing error here is an unknown session.
    if (isUserFacingError(error)) notFound();
    throw error;
  });
  const { session } = step.summary;
  const scopeLabel =
    session.scope === "all"
      ? "Everything"
      : session.scope === "tag"
        ? `Tag: ${session.scopeValue}`
        : `Source: ${(await c.sources.findById(session.scopeValue!))?.title ?? "removed"}`;

  if (step.kind === "done") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted">{scopeLabel}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{DONE_TITLES[step.reason]}</h1>
        </div>
        <Summary summary={step.summary} />
        <div className="flex flex-wrap gap-2">
          <Link href="/study" className={buttonClass.primary}>
            Start another session
          </Link>
          <Link href="/library" className={buttonClass.secondary}>
            Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Study session</h1>
          <p className="text-sm text-muted" data-testid="session-progress">
            {scopeLabel} · {step.summary.reviewed} done
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Countdown endsAt={step.endsAt.toISOString()} />
          <form action={finishSessionAction.bind(null, id)}>
            <button type="submit" className={buttonClass.secondary}>
              Finish
            </button>
          </form>
        </div>
      </div>
      <FlashcardCard key={step.card.itemId} card={step.card} sessionId={id} />
    </div>
  );
}

function Summary({ summary }: { summary: SessionSummary }) {
  const { cards, quiz } = summary.activity;
  const elapsed = summary.session.endedAt ? (summary.session.endedAt.getTime() - summary.session.startedAt.getTime()) / 60_000 : 0;
  const minutes = elapsed < 1 ? "<1" : Math.round(elapsed);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Session summary">
      <Stat label="Studied" value={summary.reviewed} />
      <Stat label="Minutes" value={minutes} />
      {quiz.answered > 0 && <Stat label="Quiz correct" value={`${quiz.correct}/${quiz.answered}`} />}
      {GRADES.map((grade) => (
        <Stat key={grade} label={grade[0]!.toUpperCase() + grade.slice(1)} value={cards[grade]} />
      ))}
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
