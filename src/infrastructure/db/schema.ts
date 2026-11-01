import { check, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * The single owner's password hash. The plaintext lives only in OWNER_PASSWORD;
 * it is hashed on first boot and re-hashed if the env value changes.
 */
export const ownerCredential = pgTable(
  "owner_credential",
  {
    id: smallint("id").primaryKey().default(1),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("owner_credential_singleton", sql`${table.id} = 1`)],
);
