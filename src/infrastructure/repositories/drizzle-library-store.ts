import { and, arrayContains, arrayOverlaps, asc, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import type { LibraryFacets, LibraryFilter, LibraryItem, LibraryStore, TextSegment } from "@/application/ports/library";
import type { Database } from "@/infrastructure/db/client";
import { itemExcerpts, items, itemSearch, sources } from "@/infrastructure/db/schema";

// ts_headline wraps matches in these control characters; they never occur in
// cleaned source text, and splitting on them avoids rendering HTML.
// HighlightAll keeps the whole excerpt: a source fact is never cut into fragments.
const START = "\u0002";
const STOP = "\u0003";
const HEADLINE_OPTIONS = `StartSel=${START}, StopSel=${STOP}, HighlightAll=true`;

/** Splits a ts_headline result into plain and matched runs. */
export function headlineSegments(headline: string): TextSegment[] {
  return headline
    .split(new RegExp(`(${START}[^${STOP}]*${STOP})`))
    .filter(Boolean)
    .map((part) => (part.startsWith(START) ? { text: part.slice(1, -1), match: true } : { text: part, match: false }));
}

export class DrizzleLibraryStore implements LibraryStore {
  constructor(private readonly db: Database) {}

  async list(filter: LibraryFilter & { tsquery?: string }): Promise<LibraryItem[]> {
    return this.select(filter);
  }

  related(item: { id: string; tags: string[]; sourceId: string }, limit: number): Promise<LibraryItem[]> {
    // Drizzle expands a JS array into a parameter list, so build the array literal explicitly.
    const tags = sql`array[${sql.join(
      item.tags.map((tag) => sql`${tag}`),
      sql`, `,
    )}]::text[]`;
    return this.select({
      where: and(
        ne(items.id, item.id),
        or(eq(items.sourceId, item.sourceId), item.tags.length > 0 ? arrayOverlaps(items.tags, item.tags) : undefined),
      ),
      orderBy: [desc(sql`cardinality(array(select unnest(${items.tags}) intersect select unnest(${tags})))`)],
      limit,
    });
  }

  private async select(filter: LibraryFilter & { tsquery?: string; where?: SQL; orderBy?: SQL[]; limit?: number }): Promise<LibraryItem[]> {
    const query = filter.tsquery ? sql`to_tsquery('english', ${filter.tsquery})` : null;
    const allExcerpts = sql`(select string_agg(${itemExcerpts.text}, ' … ' order by ${itemExcerpts.position}) from ${itemExcerpts} where ${itemExcerpts.itemId} = ${items.id})`;
    const firstExcerpt = sql`(select ${itemExcerpts.text} from ${itemExcerpts} where ${itemExcerpts.itemId} = ${items.id} order by ${itemExcerpts.position} limit 1)`;

    const statement = this.db
      .select({
        id: items.id,
        type: items.type,
        title: items.title,
        summary: items.summary,
        tags: items.tags,
        sourceId: items.sourceId,
        sourceTitle: sources.title,
        excerptCount: sql<number>`(select count(*)::int from ${itemExcerpts} where ${itemExcerpts.itemId} = ${items.id})`,
        snippet: query
          ? sql<string>`coalesce(ts_headline('english', ${allExcerpts}, ${query}, ${HEADLINE_OPTIONS}), '')`
          : sql<string>`coalesce(${firstExcerpt}, '')`,
      })
      .from(items)
      .innerJoin(sources, eq(items.sourceId, sources.id))
      .leftJoin(itemSearch, eq(itemSearch.itemId, items.id))
      .where(
        and(
          eq(items.status, "approved"),
          filter.type ? eq(items.type, filter.type) : undefined,
          filter.sourceId ? eq(items.sourceId, filter.sourceId) : undefined,
          filter.tag ? arrayContains(items.tags, [filter.tag]) : undefined,
          query ? sql`${itemSearch.document} @@ ${query}` : undefined,
          filter.where,
        ),
      )
      .orderBy(
        ...(filter.orderBy ?? []),
        ...(query ? [desc(sql`ts_rank_cd(${itemSearch.document}, ${query})`)] : []),
        asc(items.title),
        asc(items.id),
      )
      .$dynamic();
    const rows = await (filter.limit ? statement.limit(filter.limit) : statement);

    return rows.map((row) => ({
      ...row,
      snippet: query ? headlineSegments(row.snippet) : [{ text: row.snippet, match: false }],
    }));
  }

  async facets(): Promise<LibraryFacets> {
    const [[count], tags, sourceRows] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(items)
        .where(eq(items.status, "approved")),
      this.db.execute<{ tag: string }>(
        sql`select distinct unnest(${items.tags}) as tag from ${items} where ${items.status} = 'approved' order by tag`,
      ),
      this.db
        .selectDistinct({ id: sources.id, title: sources.title })
        .from(sources)
        .innerJoin(items, and(eq(items.sourceId, sources.id), eq(items.status, "approved")))
        .orderBy(asc(sources.title), asc(sources.id)),
    ]);
    return { total: count?.total ?? 0, tags: tags.map((row) => row.tag), sources: sourceRows };
  }
}
