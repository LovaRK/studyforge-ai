import { eq, sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";
import { studySessions } from "@/infrastructure/db/schema";

/** Anything that can run statements inside the caller's transaction. */
type Tx = Pick<Database, "select" | "execute">;

/**
 * Whether a study session may still record an answer about `item` at `at`. Locks
 * the session row, so answers and the end of the session are serialised: an
 * answer either lands before the session ends or not at all, and a finished
 * session's summary never changes afterwards.
 *
 * Rules: the session exists, has not ended, its deadline has not passed, the
 * item is inside its tag or source, and the item has not been studied in it yet
 * (as a card or a quiz question). Call it inside the transaction that writes the answer.
 */
export async function sessionAcceptsAnswer(
  tx: Tx,
  sessionId: string,
  item: { id: string; tags: string[]; sourceId: string },
  at: Date,
): Promise<boolean> {
  const [session] = await tx.select().from(studySessions).where(eq(studySessions.id, sessionId)).for("update");
  if (!session || session.endedAt) return false;
  if (at.getTime() >= session.startedAt.getTime() + session.plannedMinutes * 60_000) return false;
  if (session.scope === "tag" && !item.tags.includes(session.scopeValue ?? "")) return false;
  if (session.scope === "source" && item.sourceId !== session.scopeValue) return false;

  const seen = await tx.execute(sql`
    select 1 from card_reviews where session_id = ${sessionId} and item_id = ${item.id}
    union all
    select 1 from quiz_attempts where session_id = ${sessionId} and item_id = ${item.id}
    limit 1`);
  return seen.length === 0;
}
