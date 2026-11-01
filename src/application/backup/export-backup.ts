import type { BackupStore } from "@/application/ports/backup";

export const BACKUP_SCHEMA_VERSION = 1;

export function makeBackup(store: BackupStore, now = () => new Date()) {
  return {
    async export() {
      return {
        product: "StudyForge AI" as const,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: now().toISOString(),
        data: await store.snapshot(),
      };
    },
  };
}

export type Backup = ReturnType<typeof makeBackup>;
