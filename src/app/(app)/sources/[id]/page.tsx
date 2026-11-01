import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonClass } from "@/components/ui";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { ExtractionPanel } from "./extraction-panel";

export const metadata: Metadata = { title: "Source · StudyForge AI" };

/** `?at=start-end` highlights a span of the text, e.g. an excerpt opened from the library. */
const atSchema = z
  .string()
  .regex(/^\d{1,9}-\d{1,9}$/)
  .transform((value) => value.split("-").map(Number) as [number, number])
  .optional()
  .catch(undefined);

export default async function SourcePage({ params, searchParams }: PageProps<"/sources/[id]">) {
  await requireOwner();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const c = container();
  const source = await c.sources.findById(id);
  if (!source) notFound();
  const at = atSchema.parse((await searchParams).at);
  const highlight = at && at[0] < at[1] && at[1] <= source.text.length ? at : null;
  const [progress, rejected] = await Promise.all([c.sources.progress(id), c.extraction.listRejected(id)]);
  const running = c.extractionRunner.isRunning(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/sources" className="text-sm text-muted hover:text-foreground">
            ← Sources
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{source.title}</h1>
          <p className="text-sm text-muted">
            {source.attribution ? `Source: ${source.attribution} · ` : ""}
            {source.fileName} · {source.wordCount.toLocaleString()} words
          </p>
        </div>
        {progress.pendingItems > 0 && (
          <Link href={`/review?source=${source.id}`} className={buttonClass.secondary}>
            Review {progress.pendingItems} item{progress.pendingItems === 1 ? "" : "s"}
          </Link>
        )}
      </div>

      <ExtractionPanel sourceId={source.id} progress={progress} running={running} />

      <section className="space-y-2" aria-labelledby="rejected-heading">
        <h2 id="rejected-heading" className="font-medium">
          Rejected: excerpt not found <span className="text-muted tabular-nums">({rejected.length})</span>
        </h2>
        <p className="text-sm text-muted">
          The model quoted these, but the quote is not in your source word for word, so they never reached the review queue.
        </p>
        {rejected.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {rejected.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3">
                <p className="font-medium">{r.title}</p>
                <p className="text-muted">&ldquo;{r.excerpt}&rdquo;</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-lg border border-line bg-surface" open={highlight !== null}>
        <summary className="cursor-pointer px-4 py-3 font-medium">Extracted text</summary>
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words border-t border-line px-4 py-3 font-sans text-sm leading-relaxed">
          {highlight ? (
            <>
              {source.text.slice(0, highlight[0])}
              <mark id="excerpt" className="scroll-mt-24 rounded-sm bg-accent/20 px-0.5 text-foreground" data-testid="source-highlight">
                {source.text.slice(...highlight)}
              </mark>
              {source.text.slice(highlight[1])}
            </>
          ) : (
            source.text
          )}
        </pre>
      </details>
    </div>
  );
}
