import { expect, it } from "vitest";
import { BACKUP_TABLES, type BackupRows } from "@/application/ports/backup";
import { makeBackup } from "./export-backup";

it("adds a stable version and ISO timestamp to every required table", async () => {
  const rows = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as unknown as BackupRows;
  const backup = makeBackup({ snapshot: async () => rows }, () => new Date("2026-11-01T12:00:00Z"));

  await expect(backup.export()).resolves.toEqual({
    product: "StudyForge AI",
    schemaVersion: 1,
    exportedAt: "2026-11-01T12:00:00.000Z",
    data: rows,
  });
  expect(Object.keys(rows).sort()).toEqual([...BACKUP_TABLES].sort());
});
