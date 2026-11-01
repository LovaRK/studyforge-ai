import { and, arrayContains, asc, eq, gt, isNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { CardState, FlashcardCounts, GradeRecord, SrsStore, StudyScope } from "@/application/ports/flashcards";
import type { Database } from "@/infrastructure/db/client";
import { cardReviews, items, srsCards } from "@/infrastructure/db/schema";

/** Approved items within a study scope. Shared with the study-session store. */
export function approvedInScope(scope: StudyScope): SQL {
  return and(
    eq(items.status, "approved"),
    scope.scope === "tag" && scope.value ? arrayContains(items.tags, [scope.value]) : undefined,
    scope.scope === "source" && scope.value ? eq(items.sourceId, scope.value) : undefined,
  )!;
}

/** A timestamp parameter for raw SQL; the driver only serialises Dates bound to a column. */
function at(date: Date): SQL {
  return sql`${date.toISOString()}::timestamptz`;
}

const cardColumns = {
  itemId: items.id,
  easeFactor: srsCards.easeFactor,
  intervalDays: srsCards.intervalDays,
  repetitions: srsCards.repetitions,
  lapses: srsCards.lapses,
  dueAt: srsCards.dueAt,
  lastReviewedAt: srsCards.lastReviewedAt,
};

type CardRow = {
  itemId: string;
  easeFactor: number | null;
  intervalDays: number | null;
  repetitions: number | null;
  lapses: number | null;
  dueAt: Date | null;
  lastReviewedAt: Date | null;
};

function toCardState(row: CardRow): CardState {
  return {
    itemId: row.itemId,
    state:
      row.dueAt === null
        ? null
        : {
            easeFactor: row.easeFactor!,
            intervalDays: row.intervalDays!,
            repetitions: row.repetitions!,
            lapses: row.lapses!,
            dueAt: row.dueAt,
          },
    lastReviewedAt: row.lastReviewedAt,
  };
}

export class DrizzleSrsStore implements SrsStore {
  constructor(private readonly db: Database) {}

  async nextCard(scope: StudyScope, now: Date, excludeIds: string[]): Promise<CardState | null> {
    const [row] = await this.db
      .select(cardColumns)
      .from(items)
      .leftJoin(srsCards, eq(srsCards.itemId, items.id))
      .where(
        and(
          approvedInScope(scope),
          excludeIds.length > 0 ? notInArray(items.id, excludeIds) : undefined,
          or(isNull(srsCards.itemId), lte(srsCards.dueAt, now)),
        ),
      )
      // Due cards before new ones; within each, the longest waiting first.
      .orderBy(sql`${srsCards.itemId} is null`, asc(srsCards.dueAt), asc(items.reviewedAt), asc(items.id))
      .limit(1);
    return row ? toCardState(row) : null;
  }

  async cardState(itemId: string): Promise<CardState | null> {
    const [row] = await this.db
      .select(cardColumns)
      .from(items)
      .leftJoin(srsCards, eq(srsCards.itemId, items.id))
      .where(and(eq(items.id, itemId), eq(items.status, "approved")));
    return row ? toCardState(row) : null;
  }

  async counts(scope: StudyScope, now: Date, reviewedSince: Date): Promise<FlashcardCounts> {
    const [[cards], [reviews]] = await Promise.all([
      this.db
        .select({
          due: sql<number>`count(*) filter (where ${srsCards.itemId} is not null and ${srsCards.dueAt} <= ${at(now)})::int`,
          new: sql<number>`count(*) filter (where ${srsCards.itemId} is null)::int`,
          nextDueAt: sql<Date | null>`min(${srsCards.dueAt}) filter (where ${srsCards.dueAt} > ${at(now)})`.mapWith((value) =>
            value === null ? null : new Date(value),
          ),
        })
        .from(items)
        .leftJoin(srsCards, eq(srsCards.itemId, items.id))
        .where(approvedInScope(scope)),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(cardReviews)
        .innerJoin(items, eq(items.id, cardReviews.itemId))
        .where(and(approvedInScope(scope), gt(cardReviews.reviewedAt, reviewedSince))),
    ]);
    return { due: cards!.due, new: cards!.new, nextDueAt: cards!.nextDueAt, reviewedSince: reviews!.count };
  }

  async record(review: GradeRecord): Promise<boolean> {
    const { itemId, next, reviewedAt } = review;
    const values = {
      easeFactor: next.easeFactor,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastReviewedAt: reviewedAt,
    };
    const approved = sql`exists (select 1 from ${items} where ${items.id} = ${itemId} and ${items.status} = 'approved')`;

    return this.db.transaction(async (tx) => {
      // The check and the write are one statement each, so two grades of the
      // same showing cannot both pass.
      const written =
        review.expectedLastReviewedAt === null
          ? // First review: create the card unless a concurrent first review already did.
            await tx.execute(sql`
              insert into ${srsCards} (item_id, ease_factor, interval_days, repetitions, lapses, due_at, last_reviewed_at)
              select ${itemId}, ${values.easeFactor}, ${values.intervalDays}, ${values.repetitions}, ${values.lapses}, ${at(values.dueAt)}, ${at(values.lastReviewedAt)}
              where ${approved}
              on conflict (item_id) do nothing
              returning item_id`)
          : await tx
              .update(srsCards)
              .set(values)
              .where(and(eq(srsCards.itemId, itemId), eq(srsCards.lastReviewedAt, review.expectedLastReviewedAt), approved))
              .returning({ itemId: srsCards.itemId });
      if (written.length === 0) return false;

      await tx.insert(cardReviews).values({
        itemId,
        sessionId: review.sessionId,
        grade: review.grade,
        intervalDays: next.intervalDays,
        easeFactor: next.easeFactor,
        reviewedAt,
      });
      return true;
    });
  }
}
