import { eq, sql } from "drizzle-orm";
import type { DashboardSnapshot, DashboardStore } from "@/application/ports/dashboard";
import type { Database } from "@/infrastructure/db/client";
import { items, sources, srsCards, cardReviews, quizAttempts, chunks } from "@/infrastructure/db/schema";
export class DrizzleDashboardStore implements DashboardStore {
  constructor(private readonly db: Database) {}
  snapshot(): Promise<DashboardSnapshot> {
    return this.db.transaction(
      async (tx) => {
        const rows = await tx
          .select({
            id: items.id,
            sourceId: items.sourceId,
            sourceTitle: sources.title,
            tags: items.tags,
            status: items.status,
            edited: items.edited,
            repetitions: srsCards.repetitions,
            dueAt: srsCards.dueAt,
          })
          .from(items)
          .innerJoin(sources, eq(sources.id, items.sourceId))
          .leftJoin(srsCards, eq(srsCards.itemId, items.id));
        const cards = await tx.select({ at: cardReviews.reviewedAt }).from(cardReviews);
        const quizzes = await tx.select({ at: quizAttempts.answeredAt, correct: quizAttempts.correct }).from(quizAttempts);
        const [extraction] = await tx
          .select({
            verified: sql<number>`coalesce(sum(${chunks.itemCount}),0)::int`,
            rejected: sql<number>`coalesce(sum(${chunks.rejectedCount}),0)::int`,
          })
          .from(chunks);
        return {
          items: rows,
          activity: [
            ...cards.map((c) => ({ ...c, kind: "card" as const, correct: null })),
            ...quizzes.map((q) => ({ ...q, kind: "quiz" as const })),
          ],
          extraction: extraction!,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
