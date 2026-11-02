import type { BackupRows, BackupStore } from "@/application/ports/backup";
import type { Database } from "@/infrastructure/db/client";
import {
  cardReviews,
  chunks,
  itemExcerpts,
  items,
  quizAttempts,
  quizQuestions,
  rejectedExtractions,
  reviewEvents,
  sources,
  srsCards,
  studySessions,
} from "@/infrastructure/db/schema";

export class DrizzleBackupStore implements BackupStore {
  constructor(private readonly db: Database) {}

  snapshot(): Promise<BackupRows> {
    return this.db.transaction(
      async (tx) => ({
        sources: await tx.select().from(sources),
        chunks: await tx.select().from(chunks),
        items: await tx.select().from(items),
        itemExcerpts: await tx.select().from(itemExcerpts),
        rejectedExtractions: await tx.select().from(rejectedExtractions),
        reviewEvents: await tx.select().from(reviewEvents),
        srsCards: await tx.select().from(srsCards),
        cardReviews: await tx.select().from(cardReviews),
        quizQuestions: await tx.select().from(quizQuestions),
        quizAttempts: await tx.select().from(quizAttempts),
        studySessions: await tx.select().from(studySessions),
      }),
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
