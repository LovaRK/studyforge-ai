import { and, eq, isNull, sql } from "drizzle-orm";
import type { SessionActivity, StudySessionRecord, StudySessionStore } from "@/application/ports/study-session";
import { GRADES, type Grade, type SessionEndReason } from "@/domain/study/types";
import type { Database } from "@/infrastructure/db/client";
import { cardReviews, quizAttempts, studySessions } from "@/infrastructure/db/schema";

export class DrizzleStudySessionStore implements StudySessionStore {
  constructor(private readonly db: Database) {}

  async start(session: Omit<StudySessionRecord, "id" | "endedAt" | "endReason">): Promise<string> {
    const [row] = await this.db.insert(studySessions).values(session).returning({ id: studySessions.id });
    return row!.id;
  }

  async get(id: string): Promise<StudySessionRecord | null> {
    const [row] = await this.db.select().from(studySessions).where(eq(studySessions.id, id));
    return row ?? null;
  }

  async end(id: string, endedAt: Date, reason: SessionEndReason): Promise<StudySessionRecord | null> {
    await this.db
      .update(studySessions)
      .set({ endedAt, endReason: reason })
      .where(and(eq(studySessions.id, id), isNull(studySessions.endedAt)));
    // Read back: if another request ended it first, its reason stands.
    return this.get(id);
  }

  async activity(id: string): Promise<SessionActivity> {
    const [grades, [quiz], seen] = await Promise.all([
      this.db
        .select({ grade: cardReviews.grade, count: sql<number>`count(*)::int` })
        .from(cardReviews)
        .where(eq(cardReviews.sessionId, id))
        .groupBy(cardReviews.grade),
      this.db
        .select({ answered: sql<number>`count(*)::int`, correct: sql<number>`count(*) filter (where ${quizAttempts.correct})::int` })
        .from(quizAttempts)
        .where(eq(quizAttempts.sessionId, id)),
      this.db.execute<{ item_id: string }>(
        sql`select ${cardReviews.itemId} as item_id from ${cardReviews} where ${cardReviews.sessionId} = ${id}
            union select ${quizAttempts.itemId} from ${quizAttempts} where ${quizAttempts.sessionId} = ${id}`,
      ),
    ]);
    const cards = Object.fromEntries(GRADES.map((grade) => [grade, 0])) as Record<Grade, number>;
    for (const row of grades) cards[row.grade] = row.count;
    return { cards, quiz: { answered: quiz!.answered, correct: quiz!.correct }, seenItemIds: seen.map((row) => row.item_id) };
  }
}
