export const BACKUP_TABLES = [
  "sources",
  "chunks",
  "items",
  "itemExcerpts",
  "rejectedExtractions",
  "reviewEvents",
  "srsCards",
  "cardReviews",
  "quizQuestions",
  "quizAttempts",
  "studySessions",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRows = Record<BackupTable, readonly unknown[]>;

export interface BackupStore {
  /** Reads one repeatable snapshot. Credentials, secrets and the LLM cache are deliberately excluded. */
  snapshot(): Promise<BackupRows>;
}
