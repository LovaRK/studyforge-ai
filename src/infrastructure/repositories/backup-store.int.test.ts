import { afterAll, beforeEach, expect, it } from "vitest";
import { BACKUP_TABLES } from "@/application/ports/backup";
import { ownerCredential, sources } from "@/infrastructure/db/schema";
import { connect, truncateAll } from "@/test/integration/database";
import { DrizzleBackupStore } from "./drizzle-backup-store";

const { client, db } = connect();
const store = new DrizzleBackupStore(db);

beforeEach(() => truncateAll(db));
afterAll(() => client.end());

it("exports every durable study table and excludes credentials", async () => {
  await db.insert(ownerCredential).values({ passwordHash: "sensitive-hash" });
  await db.insert(sources).values({
    title: "Notes",
    fileName: "notes.txt",
    mimeType: "text/plain",
    text: "Private source text",
    wordCount: 3,
  });

  const snapshot = await store.snapshot();
  expect(Object.keys(snapshot).sort()).toEqual([...BACKUP_TABLES].sort());
  expect(snapshot.sources).toHaveLength(1);
  expect(JSON.stringify(snapshot)).not.toContain("sensitive-hash");
});
