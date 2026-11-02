import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, EmptyState } from "@/components/ui";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { StartSessionForm } from "./start-form";

export const metadata: Metadata = { title: "Study · StudyForge AI" };

export default async function StudyPage() {
  await requireOwner();
  const facets = await container().library.facets();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Focused study</h1>
        <p className="text-muted">
          Pick a tag or a source and a length. Due flashcards come first, then new ones alternate with quiz questions, each item once, until
          the time is up.
        </p>
      </div>
      {facets.total === 0 ? (
        <EmptyState title="No approved items yet">
          <p>Sessions use only items you approve.</p>
          <Link href="/review" className={`${buttonClass.secondary} mt-3`}>
            Open the review queue
          </Link>
        </EmptyState>
      ) : (
        <StartSessionForm tags={facets.tags} sources={facets.sources} />
      )}
    </div>
  );
}
