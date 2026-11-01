import { eq, sql } from "drizzle-orm";
import type { DemoStore } from "@/application/ports/demo";
import type { NewChunk, NewSource, SourceRecord } from "@/application/ports/study";
import type { Database } from "@/infrastructure/db/client";
import { chunks, sources } from "@/infrastructure/db/schema";

const DEMO_LOCK = 7_844_563_219;

export class DrizzleDemoStore implements DemoStore {
  constructor(private readonly db: Database) {}

  ensureSource(source: NewSource, newChunks: NewChunk[]): Promise<SourceRecord> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${DEMO_LOCK})`);
      const [existing] = await tx.select().from(sources).where(eq(sources.fileName, source.fileName)).limit(1);
      if (existing) return existing;

      const [created] = await tx.insert(sources).values(source).returning();
      if (newChunks.length) {
        await tx.insert(chunks).values(
          newChunks.map((chunk) => ({
            sourceId: created!.id,
            ordinal: chunk.ordinal,
            heading: chunk.heading,
            startOffset: chunk.start,
            endOffset: chunk.end,
            wordCount: chunk.wordCount,
          })),
        );
      }
      return created!;
    });
  }
}
