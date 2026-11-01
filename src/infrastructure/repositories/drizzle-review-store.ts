import { and, arrayContains, asc, eq, inArray, sql } from "drizzle-orm";
import { ItemNotPendingError, type ItemView, type MergeCandidate, type QueueFilter, type ReviewStore } from "@/application/ports/study";
import type { GeneratedFields, ReviewAction } from "@/domain/items/item";
import type { Database } from "@/infrastructure/db/client";
import { itemExcerpts, items, reviewEvents, sources } from "@/infrastructure/db/schema";

export class DrizzleReviewStore implements ReviewStore {
  constructor(private readonly db: Database) {}

  private async load(where: ReturnType<typeof and>): Promise<ItemView[]> {
    const rows = await this.db
      .select({ item: items, sourceTitle: sources.title, sourceAttribution: sources.attribution })
      .from(items)
      .innerJoin(sources, eq(items.sourceId, sources.id))
      .where(where)
      .orderBy(asc(items.createdAt), asc(items.id));
    if (rows.length === 0) return [];

    // Each excerpt carries its own document: merged items can span several sources.
    const excerpts = await this.db
      .select({
        itemId: itemExcerpts.itemId,
        sourceId: itemExcerpts.sourceId,
        text: itemExcerpts.text,
        startOffset: itemExcerpts.startOffset,
        endOffset: itemExcerpts.endOffset,
        sourceTitle: sources.title,
        sourceAttribution: sources.attribution,
      })
      .from(itemExcerpts)
      .innerJoin(sources, eq(itemExcerpts.sourceId, sources.id))
      .where(
        inArray(
          itemExcerpts.itemId,
          rows.map((r) => r.item.id),
        ),
      )
      .orderBy(asc(itemExcerpts.position));

    return rows.map(({ item, sourceTitle, sourceAttribution }) => ({
      id: item.id,
      sourceId: item.sourceId,
      sourceTitle,
      sourceAttribution,
      type: item.type,
      title: item.title,
      summary: item.summary,
      question: item.question,
      answer: item.answer,
      tags: item.tags,
      status: item.status,
      edited: item.edited,
      createdAt: item.createdAt,
      excerpts: excerpts
        .filter((e) => e.itemId === item.id)
        .map((e) => ({
          sourceId: e.sourceId,
          sourceTitle: e.sourceTitle,
          sourceAttribution: e.sourceAttribution,
          text: e.text,
          start: e.startOffset,
          end: e.endOffset,
        })),
    }));
  }

  listQueue(filter: QueueFilter): Promise<ItemView[]> {
    return this.load(
      and(
        eq(items.status, "pending"),
        filter.type ? eq(items.type, filter.type) : undefined,
        filter.sourceId ? eq(items.sourceId, filter.sourceId) : undefined,
        filter.tag ? arrayContains(items.tags, [filter.tag]) : undefined,
      ),
    );
  }

  async queueTags(): Promise<string[]> {
    const rows = await this.db.execute<{ tag: string }>(
      sql`select distinct unnest(${items.tags}) as tag from ${items} where ${items.status} = 'pending' order by tag`,
    );
    return rows.map((r) => r.tag);
  }

  async getItem(id: string): Promise<ItemView | null> {
    const [item] = await this.load(and(eq(items.id, id)));
    return item ?? null;
  }

  async setStatus(ids: string[], status: "approved" | "discarded", action: ReviewAction): Promise<string[]> {
    if (ids.length === 0) return [];
    return this.db.transaction(async (tx) => {
      const changed = await tx
        .update(items)
        .set({ status, reviewedAt: new Date() })
        .where(and(inArray(items.id, ids), eq(items.status, "pending")))
        .returning({ id: items.id });
      if (changed.length > 0) await tx.insert(reviewEvents).values(changed.map(({ id }) => ({ itemId: id, action })));
      return changed.map(({ id }) => id);
    });
  }

  async updateFields(id: string, fields: GeneratedFields): Promise<void> {
    await this.db.transaction(async (tx) => {
      // The status condition and the write are one statement, so a concurrent approval wins cleanly.
      const changed = await tx
        .update(items)
        .set({ ...fields, edited: true })
        .where(and(eq(items.id, id), eq(items.status, "pending")))
        .returning({ id: items.id });
      if (changed.length === 0) throw new ItemNotPendingError([id]);
      await tx.insert(reviewEvents).values({ itemId: id, action: "edit" });
    });
  }

  async setTags(id: string, tags: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const changed = await tx
        .update(items)
        .set({ tags })
        .where(and(eq(items.id, id), eq(items.status, "pending")))
        .returning({ id: items.id });
      if (changed.length === 0) throw new ItemNotPendingError([id]);
      await tx.insert(reviewEvents).values({ itemId: id, action: "tag", details: { tags } });
    });
  }

  async merge(ids: string[], build: (items: MergeCandidate[]) => GeneratedFields & { tags: string[] }): Promise<string> {
    return this.db.transaction(async (tx) => {
      // Lock the rows first: concurrent approvals and edits wait, and we read their final state.
      const locked = await tx
        .select({
          id: items.id,
          sourceId: items.sourceId,
          status: items.status,
          type: items.type,
          title: items.title,
          summary: items.summary,
          question: items.question,
          answer: items.answer,
          tags: items.tags,
        })
        .from(items)
        .where(inArray(items.id, ids))
        .orderBy(asc(items.id))
        .for("update");

      const pendingIds = new Set(locked.filter((row) => row.status === "pending").map((row) => row.id));
      const stale = ids.filter((id) => !pendingIds.has(id));
      if (stale.length > 0) throw new ItemNotPendingError(stale);

      // Back in the order the owner selected.
      const ordered = ids.map((id) => locked.find((row) => row.id === id)!);
      const fields = build(ordered);
      const [merged] = await tx
        .insert(items)
        .values({ ...fields, sourceId: ordered[0]!.sourceId, edited: true })
        .returning({ id: items.id });

      const excerpts = await tx.select().from(itemExcerpts).where(inArray(itemExcerpts.itemId, ids));
      // Keep the order the owner selected, then position within each item.
      excerpts.sort((a, b) => ids.indexOf(a.itemId) - ids.indexOf(b.itemId) || a.position - b.position);
      await tx.insert(itemExcerpts).values(
        excerpts.map((e, position) => ({
          itemId: merged!.id,
          sourceId: e.sourceId,
          text: e.text,
          startOffset: e.startOffset,
          endOffset: e.endOffset,
          position,
        })),
      );

      await tx.update(items).set({ status: "merged", mergedIntoId: merged!.id, reviewedAt: new Date() }).where(inArray(items.id, ids));
      await tx
        .insert(reviewEvents)
        .values([
          ...ids.map((id) => ({ itemId: id, action: "merge" as const, details: { mergedInto: merged!.id } })),
          { itemId: merged!.id, action: "merge" as const, details: { mergedFrom: ids } },
        ]);
      return merged!.id;
    });
  }
}
