import type { Metadata } from "next";
import { z } from "zod";
import { ITEM_TYPES } from "@/domain/items/item";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { ReviewQueue, type SourceContext } from "./review-queue";

export const metadata: Metadata = { title: "Review · StudyForge AI" };

const CONTEXT_CHARS = 1200;

const filtersSchema = z.object({
  type: z.enum(ITEM_TYPES).optional().catch(undefined),
  tag: z.string().max(40).optional().catch(undefined),
  source: z.string().uuid().optional().catch(undefined),
  item: z.string().uuid().optional().catch(undefined),
});

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  await requireOwner();
  const filters = filtersSchema.parse(await searchParams);
  const c = container();

  const [queue, tags, sources] = await Promise.all([
    c.reviewStore.listQueue({ type: filters.type, tag: filters.tag, sourceId: filters.source }),
    c.reviewStore.queueTags(),
    c.sources.list(),
  ]);

  const selected = queue.find((item) => item.id === filters.item) ?? queue[0] ?? null;

  // The source text around each excerpt of the selected item, for the right-hand pane.
  let context: SourceContext[] = [];
  if (selected) {
    const source = await c.sources.findById(selected.sourceId);
    if (source) {
      context = selected.excerpts.map((excerpt) => ({
        before: source.text.slice(Math.max(0, excerpt.start - CONTEXT_CHARS), excerpt.start),
        match: source.text.slice(excerpt.start, excerpt.end),
        after: source.text.slice(excerpt.end, excerpt.end + CONTEXT_CHARS),
        truncatedBefore: excerpt.start > CONTEXT_CHARS,
        truncatedAfter: excerpt.end + CONTEXT_CHARS < source.text.length,
      }));
    }
  }

  return (
    <ReviewQueue
      queue={queue}
      selected={selected}
      context={context}
      tags={tags}
      sources={sources.map((s) => ({ id: s.id, title: s.title }))}
      filters={{ type: filters.type, tag: filters.tag, source: filters.source }}
    />
  );
}
