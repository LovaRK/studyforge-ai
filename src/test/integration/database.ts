import { existsSync } from "node:fs";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Database } from "@/infrastructure/db/client";
import * as schema from "@/infrastructure/db/schema";

if (existsSync(".env.local")) config({ path: ".env.local", quiet: true });

/** DATABASE_URL with a suffix on the database name, e.g. `studyforge_test`. */
export function databaseUrlWithSuffix(suffix: string): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL to run database tests.");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/^\//, "")}_${suffix}`;
  return url.toString();
}

export function testDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? databaseUrlWithSuffix("test");
}

export function connect(url = testDatabaseUrl()) {
  const client = postgres(url, { max: 2, onnotice: () => {} });
  return { client, db: drizzle(client, { schema }) as Database };
}

/** Empties every application table. */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table card_reviews, quiz_attempts, quiz_questions, study_sessions, srs_cards, item_search, review_events, item_excerpts, items, rejected_extractions, llm_cache, chunks, sources, owner_credential restart identity cascade`,
  );
}

/** Creates the database if it is missing, applies migrations, and optionally empties it. */
export async function prepareDatabase(databaseUrl: string, options: { truncate?: boolean } = {}): Promise<void> {
  const url = new URL(databaseUrl);
  const name = url.pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unexpected database name: ${name}`);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!exists) await admin.unsafe(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const { client, db } = connect(databaseUrl);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    if (options.truncate) await truncateAll(db);
  } finally {
    await client.end();
  }
}
