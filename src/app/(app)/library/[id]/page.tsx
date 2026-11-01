import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { ExcerptInContext } from "@/application/library/concept-page";
import { Badge, buttonClass, GeneratedLabel, SourceFactLabel } from "@/components/ui";
import { ITEM_TYPE_LABELS } from "@/domain/items/item";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export const metadata: Metadata = { title: "Library · StudyForge AI" };

export default async function ConceptPage({ params }: PageProps<"/library/[id]">) {
  await requireOwner();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const page = await container().conceptPages.get(id);
  if (!page) notFound();
  const { item, steps, excerpts, related } = page;
  const sourceTitles = [...new Set(excerpts.map((e) => e.sourceTitle))];

  return (
    <article className="mx-auto max-w-3xl space-y-8" aria-labelledby="item-title">
      <header className="space-y-2">
        <Link href="/library" className="text-sm text-muted hover:text-foreground">
          ← Library
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{item.type === "how_to" ? "How-to guide" : ITEM_TYPE_LABELS[item.type]}</Badge>
          {item.edited && <Badge>Edited</Badge>}
        </div>
        <h1 id="item-title" className="text-2xl font-semibold tracking-tight">
          {item.title}
        </h1>
        <p className="text-sm text-muted">From {sourceTitles.join(", ")}</p>
        {item.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Tags">
            {item.tags.map((tag) => (
              <li key={tag}>
                <Link href={`/library?tag=${encodeURIComponent(tag)}`} className="hover:opacity-80">
                  <Badge>{tag}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      <section aria-labelledby="summary-heading" className="space-y-2 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="summary-heading" className="font-semibold">
            Summary
          </h2>
          <GeneratedLabel />
        </div>
        <p className="whitespace-pre-line leading-relaxed">{item.summary}</p>
      </section>

      {steps ? (
        <section aria-labelledby="steps-heading" className="space-y-2 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="steps-heading" className="font-semibold">
              Steps
            </h2>
            <GeneratedLabel />
          </div>
          <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed marker:text-muted">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </section>
      ) : (
        <section aria-labelledby="qa-heading" className="space-y-2 rounded-lg border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="qa-heading" className="font-semibold">
              Check yourself
            </h2>
            <GeneratedLabel />
          </div>
          <p className="font-medium">{item.question}</p>
          <details>
            <summary className="cursor-pointer text-sm text-muted hover:text-foreground">Show answer</summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{item.answer}</p>
          </details>
        </section>
      )}

      <section aria-labelledby="facts-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="facts-heading" className="font-semibold">
            Source facts <span className="font-normal text-muted tabular-nums">({excerpts.length})</span>
          </h2>
          <p className="text-sm text-muted">
            Copied word for word from your sources and verified. Everything above is checked against these.
          </p>
        </div>
        {excerpts.map((excerpt, i) => (
          <Excerpt key={i} excerpt={excerpt} />
        ))}
      </section>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="space-y-2">
          <h2 id="related-heading" className="font-semibold">
            Related
          </h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {related.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/library/${other.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 hover:bg-subtle"
                >
                  <span className="font-medium">{other.title}</span>
                  <span className="text-xs text-muted">
                    {ITEM_TYPE_LABELS[other.type]} · {other.sourceTitle}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Excerpt({ excerpt }: { excerpt: ExcerptInContext }) {
  const { context } = excerpt;
  return (
    <figure className="space-y-2 rounded-lg border border-line bg-surface p-4" data-testid="source-fact">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SourceFactLabel />
        <figcaption className="text-xs text-muted" data-testid="source-fact-source">
          {excerpt.sourceTitle}
          {excerpt.sourceAttribution && ` · Source: ${excerpt.sourceAttribution}`}
        </figcaption>
      </div>
      <blockquote className="whitespace-pre-line border-l-2 border-accent pl-3 text-sm leading-relaxed">
        <span className="text-muted">
          {context.truncatedBefore && "… "}
          {context.before}
        </span>
        <mark className="rounded-sm bg-accent/20 px-0.5 text-foreground" data-testid="source-fact-quote">
          {context.match}
        </mark>
        <span className="text-muted">
          {context.after}
          {context.truncatedAfter && " …"}
        </span>
      </blockquote>
      <Link href={`/sources/${excerpt.sourceId}?at=${excerpt.start}-${excerpt.end}#excerpt`} className={`${buttonClass.secondary} text-xs`}>
        Open in source
      </Link>
    </figure>
  );
}
