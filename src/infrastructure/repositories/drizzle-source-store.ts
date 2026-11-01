import { desc, eq, sql } from "drizzle-orm";
import type { ExtractionProgress, NewChunk, NewSource, SourceRecord, SourceStore, SourceSummary } from "@/application/ports/study";
import type { Database } from "@/infrastructure/db/client";
import { chunks, sources } from "@/infrastructure/db/schema";

/**
 * Per-source counts, computed in one round trip. The outer column is written
 * as "sources"."id": an unqualified id would bind to the subquery's own table.
 */
const progressColumns = {
  totalChunks: sql<number>`(select count(*) from chunks c where c.source_id = "sources"."id")::int`,
  doneChunks: sql<number>`(select count(*) from chunks c where c.source_id = "sources"."id" and c.status = 'done')::int`,
  failedChunks: sql<number>`(select count(*) from chunks c where c.source_id = "sources"."id" and c.status = 'failed')::int`,
  processingChunks: sql<number>`(select count(*) from chunks c where c.source_id = "sources"."id" and c.status = 'processing')::int`,
  pendingItems: sql<number>`(select count(*) from items i where i.source_id = "sources"."id" and i.status = 'pending')::int`,
  approvedItems: sql<number>`(select count(*) from items i where i.source_id = "sources"."id" and i.status = 'approved')::int`,
  rejectedItems: sql<number>`(select count(*) from rejected_extractions r where r.source_id = "sources"."id")::int`,
};

export class DrizzleSourceStore implements SourceStore {
  constructor(private readonly db: Database) {}

  async create(source: NewSource, newChunks: NewChunk[]): Promise<SourceRecord> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(sources).values(source).returning();
      if (newChunks.length > 0) {
        await tx.insert(chunks).values(
          newChunks.map((chunk) => ({
            sourceId: row!.id,
            ordinal: chunk.ordinal,
            heading: chunk.heading,
            startOffset: chunk.start,
            endOffset: chunk.end,
            wordCount: chunk.wordCount,
          })),
        );
      }
      return row!;
    });
  }

  async findById(id: string): Promise<SourceRecord | null> {
    const [row] = await this.db.select().from(sources).where(eq(sources.id, id)).limit(1);
    return row ?? null;
  }

  async list(): Promise<SourceSummary[]> {
    return this.db
      .select({
        id: sources.id,
        title: sources.title,
        attribution: sources.attribution,
        fileName: sources.fileName,
        wordCount: sources.wordCount,
        createdAt: sources.createdAt,
        ...progressColumns,
      })
      .from(sources)
      .orderBy(desc(sources.createdAt));
  }

  async progress(sourceId: string): Promise<ExtractionProgress> {
    const [row] = await this.db.select(progressColumns).from(sources).where(eq(sources.id, sourceId));
    return (
      row ?? { totalChunks: 0, doneChunks: 0, failedChunks: 0, processingChunks: 0, pendingItems: 0, approvedItems: 0, rejectedItems: 0 }
    );
  }
}
