import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { ChunkRecord, ExtractionStore, LlmCache, RejectedItem, RejectedRecord, VerifiedItem } from "@/application/ports/study";
import type { Database } from "@/infrastructure/db/client";
import { chunks, itemExcerpts, items, llmCache, rejectedExtractions } from "@/infrastructure/db/schema";

export class DrizzleExtractionStore implements ExtractionStore {
  constructor(private readonly db: Database) {}

  async chunksToProcess(sourceId: string): Promise<ChunkRecord[]> {
    return this.db
      .select({
        id: chunks.id,
        sourceId: chunks.sourceId,
        ordinal: chunks.ordinal,
        start: chunks.startOffset,
        end: chunks.endOffset,
        attempts: chunks.attempts,
      })
      .from(chunks)
      .where(and(eq(chunks.sourceId, sourceId), ne(chunks.status, "done")))
      .orderBy(asc(chunks.ordinal));
  }

  async markProcessing(chunkId: string): Promise<void> {
    await this.db
      .update(chunks)
      .set({ status: "processing", attempts: sql`${chunks.attempts} + 1`, lastError: null })
      .where(eq(chunks.id, chunkId));
  }

  async markFailed(chunkId: string, error: string): Promise<void> {
    await this.db
      .update(chunks)
      .set({ status: "failed", lastError: error.slice(0, 500) })
      .where(eq(chunks.id, chunkId));
  }

  async saveChunkResult(chunk: ChunkRecord, verified: VerifiedItem[], rejected: RejectedItem[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const item of verified) {
        const [row] = await tx
          .insert(items)
          .values({
            sourceId: chunk.sourceId,
            chunkId: chunk.id,
            type: item.type,
            title: item.title,
            summary: item.summary,
            question: item.question,
            answer: item.answer,
            tags: item.tags,
          })
          .returning({ id: items.id });
        await tx.insert(itemExcerpts).values({
          itemId: row!.id,
          sourceId: item.excerpt.sourceId,
          text: item.excerpt.text,
          startOffset: item.excerpt.start,
          endOffset: item.excerpt.end,
        });
      }
      if (rejected.length > 0) {
        await tx.insert(rejectedExtractions).values(rejected.map((r) => ({ ...r, sourceId: chunk.sourceId, chunkId: chunk.id })));
      }
      await tx
        .update(chunks)
        .set({ status: "done", itemCount: verified.length, rejectedCount: rejected.length, processedAt: new Date(), lastError: null })
        .where(eq(chunks.id, chunk.id));
    });
  }

  async listRejected(sourceId: string): Promise<RejectedRecord[]> {
    const rows = await this.db
      .select()
      .from(rejectedExtractions)
      .where(eq(rejectedExtractions.sourceId, sourceId))
      .orderBy(desc(rejectedExtractions.createdAt));
    return rows.map((r) => ({ id: r.id, type: r.type, title: r.title, excerpt: r.excerpt, reason: "excerpt_not_found", createdAt: r.createdAt }));
  }
}

export class DrizzleLlmCache implements LlmCache {
  constructor(private readonly db: Database) {}

  async get(key: string): Promise<unknown | null> {
    const [row] = await this.db.select({ response: llmCache.response }).from(llmCache).where(eq(llmCache.key, key)).limit(1);
    return row?.response ?? null;
  }

  async set(key: string, entry: { provider: string; model: string; response: unknown }): Promise<void> {
    await this.db
      .insert(llmCache)
      .values({ key, ...entry })
      .onConflictDoUpdate({ target: llmCache.key, set: { response: entry.response, createdAt: new Date() } });
  }
}
