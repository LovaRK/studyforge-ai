import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, EmptyState } from "@/components/ui";
import { formatWait } from "@/domain/study/srs";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { ScopePicker } from "../scope-picker";
import { parseStudyScope } from "../study-scope";
import { FlashcardCard } from "./flashcard-card";

export const metadata: Metadata = { title: "Flashcards · StudyForge AI" };

export default async function FlashcardsPage({ searchParams }: PageProps<"/flashcards">) {
  await requireOwner();
  const scope = parseStudyScope(await searchParams);
  const c = container();
  const [{ card, counts }, facets] = await Promise.all([c.flashcards.next(scope), c.library.facets()]);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
          <p className="text-sm text-muted tabular-nums" role="status" data-testid="flashcard-counts">
            {counts.due} due · {counts.new} new · {counts.reviewedSince} reviewed in the last 24 hours
          </p>
        </div>
        {facets.total > 0 && (
          <ScopePicker tags={facets.tags} sources={facets.sources} value={scope.scope === "all" ? "" : `${scope.scope}:${scope.value}`} />
        )}
      </div>

      {facets.total === 0 ? (
        <EmptyState title="No approved items yet">
          <p>Flashcards are made only from items you approve.</p>
          <Link href="/review" className={`${buttonClass.secondary} mt-3`}>
            Open the review queue
          </Link>
        </EmptyState>
      ) : card ? (
        <FlashcardCard key={`${card.itemId}:${card.version}`} card={card} />
      ) : (
        <EmptyState title="All caught up">
          {counts.nextDueAt ? `The next card is due in ${formatWait(now, counts.nextDueAt)}.` : "Nothing in this selection is waiting."}
        </EmptyState>
      )}

      <p className="text-xs text-muted">
        Scheduled with SM-2: Again brings a card back in 10 minutes; Hard, Good and Easy space it out further each time you know it.
      </p>
    </div>
  );
}
