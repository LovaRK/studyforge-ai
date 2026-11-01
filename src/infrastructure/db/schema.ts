import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ITEM_STATUSES, ITEM_TYPES, REVIEW_ACTIONS } from "@/domain/items/item";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * The single owner's password hash. The plaintext lives only in OWNER_PASSWORD;
 * it is hashed on first boot and re-hashed if the env value changes.
 */
export const ownerCredential = pgTable(
  "owner_credential",
  {
    id: smallint("id").primaryKey().default(1),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("owner_credential_singleton", sql`${table.id} = 1`)],
);

/** An uploaded document and the text extracted from it. */
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  attribution: text("attribution"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  text: text("text").notNull(),
  wordCount: integer("word_count").notNull(),
  createdAt: createdAt(),
});

export const chunkStatus = pgEnum("chunk_status", ["pending", "processing", "done", "failed"]);

/** A slice of a source sent to the model in one call. `text = source.text[start, end)`. */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    heading: text("heading"),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    wordCount: integer("word_count").notNull(),
    status: chunkStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    itemCount: integer("item_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("chunks_source_ordinal").on(table.sourceId, table.ordinal)],
);

/** Model responses keyed by provider, model, prompt version and chunk text hash. */
export const llmCache = pgTable("llm_cache", {
  key: text("key").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  response: jsonb("response").notNull(),
  createdAt: createdAt(),
});

export const itemType = pgEnum("item_type", ITEM_TYPES);
export const itemStatus = pgEnum("item_status", ITEM_STATUSES);

/** A study item. Its title, summary, question and answer are generated interpretation. */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    chunkId: uuid("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    type: itemType("type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: itemStatus("status").notNull().default("pending"),
    edited: boolean("edited").notNull().default(false),
    mergedIntoId: uuid("merged_into_id"),
    createdAt: createdAt(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [index("items_status_created").on(table.status, table.createdAt), index("items_source").on(table.sourceId)],
);

/** Verbatim source spans behind an item: the source facts. Merged items keep every excerpt. */
export const itemExcerpts = pgTable(
  "item_excerpts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("item_excerpts_item").on(table.itemId)],
);

/** Items the word-for-word check threw out before they reached the queue. */
export const rejectedExtractions = pgTable("rejected_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  chunkId: uuid("chunk_id").references(() => chunks.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

export const reviewAction = pgEnum("review_action", REVIEW_ACTIONS);

/** Audit trail of review decisions, for the understanding dashboard. */
export const reviewEvents = pgTable("review_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  action: reviewAction("action").notNull(),
  details: jsonb("details"),
  createdAt: createdAt(),
});
