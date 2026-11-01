import { sql } from "drizzle-orm";
import type { Database } from "@/infrastructure/db/client";

/** Anything that can run a statement: the database or an open transaction. */
type Executor = Pick<Database, "execute">;

/**
 * (Re)writes the full-text document of approved items. The weighting lives in
 * the `item_search_document` SQL function (migration 0003); call this in the
 * same transaction as any write that approves an item or changes one that is
 * already approved.
 */
export async function indexApprovedItems(db: Executor, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  await db.execute(sql`
    insert into item_search (item_id, document, updated_at)
    select id, item_search_document(id), now() from items
    where status = 'approved' and id in (${sql.join(
      itemIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    on conflict (item_id) do update set document = excluded.document, updated_at = excluded.updated_at
  `);
}
