import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import type { LibraryItem } from "@/application/ports/library";
import { Badge, buttonClass, EmptyState, GeneratedLabel, SourceFactLabel } from "@/components/ui";
import { ITEM_TYPE_LABELS, ITEM_TYPES } from "@/domain/items/item";
import { MAX_SEARCH_LENGTH } from "@/domain/text/search-query";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { LibraryFilters, type LibraryFilterValues } from "./library-filters";

export const metadata: Metadata = { title: "Library · StudyForge AI" };

const filtersSchema = z.object({
  q: z
    .string()
    .transform((q) => q.trim().slice(0, MAX_SEARCH_LENGTH) || undefined)
    .optional()
    .catch(undefined),
  type: z.enum(ITEM_TYPES).optional().catch(undefined),
  tag: z.string().max(40).optional().catch(undefined),
  source: z.string().uuid().optional().catch(undefined),
});

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  await requireOwner();
  const filters: LibraryFilterValues = filtersSchema.parse(await searchParams);
  const { library } = container();
  const [page, facets] = await Promise.all([
    library.browse({ query: filters.q, type: filters.type, tag: filters.tag || undefined, sourceId: filters.source }),
    library.facets(),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <p className="max-w-prose text-muted">
          Everything you approved, grouped by type. Search looks through titles, tags, the generated wording and the verbatim excerpts.
        </p>
      </div>

      {facets.total === 0 ? (
        <EmptyState title="Your library is empty">
          <p>Approved items appear here.</p>
          <Link href="/review" className={`${buttonClass.secondary} mt-3`}>
            Open the review queue
          </Link>
        </EmptyState>
      ) : (
        <>
          {/* Keyed by the filters so the inputs reset when the URL changes (Clear, back, a tag link). */}
          <LibraryFilters key={JSON.stringify(filters)} filters={filters} tags={facets.tags} sources={facets.sources} />
          <p role="status" className="text-sm text-muted">
            {page.searched
              ? `${page.total} ${page.total === 1 ? "match" : "matches"} for “${filters.q}”, best first`
              : `${page.total} of ${facets.total} approved ${facets.total === 1 ? "item" : "items"}`}
          </p>
          {page.total === 0 ? (
            <EmptyState title="Nothing matches">Try fewer or shorter words, or clear the filters.</EmptyState>
          ) : (
            page.groups.map((group) => (
              <section key={group.type} aria-labelledby={`group-${group.type}`} className="space-y-3">
                <h2 id={`group-${group.type}`} className="flex items-baseline gap-2 text-lg font-semibold">
                  {ITEM_TYPE_LABELS[group.type]}
                  <span className="text-sm font-normal text-muted tabular-nums">{group.items.length}</span>
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <LibraryCard item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}

function LibraryCard({ item }: { item: LibraryItem }) {
  return (
    <article aria-label={item.title} className="h-full space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="space-y-0.5">
        <h3 className="font-medium">{item.title}</h3>
        <p className="text-xs text-muted">
          {item.sourceTitle}
          {item.excerptCount > 1 && ` · ${item.excerptCount} excerpts`}
        </p>
      </div>
      <div className="space-y-1">
        <GeneratedLabel />
        <p className="line-clamp-3 text-sm">{item.summary}</p>
      </div>
      <div className="space-y-1">
        <SourceFactLabel />
        <blockquote className="line-clamp-4 border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted" data-testid="library-snippet">
          {item.snippet.map((segment, i) =>
            segment.match ? (
              <mark key={i} className="rounded-sm bg-accent/20 px-0.5 text-foreground">
                {segment.text}
              </mark>
            ) : (
              segment.text
            ),
          )}
        </blockquote>
      </div>
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
    </article>
  );
}
