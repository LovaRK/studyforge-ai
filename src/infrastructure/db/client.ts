import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { studyforgeDb?: Database };

/** One pooled connection per process; reused across dev hot reloads. */
export function getDb(databaseUrl: string): Database {
  globalForDb.studyforgeDb ??= drizzle(postgres(databaseUrl, { max: 5 }), { schema });
  return globalForDb.studyforgeDb;
}
