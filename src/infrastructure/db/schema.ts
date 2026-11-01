import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ITEM_STATUSES, ITEM_TYPES, REVIEW_ACTIONS } from "@/domain/items/item";
import { GRADES, SESSION_SCOPES, type QuizOption } from "@/domain/study/types";

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

/** Postgres full-text vector. */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/**
 * Full-text search document for an approved item: its generated wording plus its
 * verbatim excerpts. Written by the library code whenever an approved item changes.
 */
export const itemSearch = pgTable(
  "item_search",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    document: tsvector("document").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("item_search_document").using("gin", table.document)],
);

export const grade = pgEnum("grade", GRADES);

/** SM-2 state, one row per approved item that has entered flashcard study. */
export const srsCards = pgTable(
  "srs_cards",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => items.id, { onDelete: "cascade" }),
    easeFactor: real("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    repetitions: integer("repetitions").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  },
  (table) => [index("srs_cards_due").on(table.dueAt)],
);

/** Every flashcard answer, for streaks, accuracy and mastery. */
export const cardReviews = pgTable(
  "card_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "set null" }),
    grade: grade("grade").notNull(),
    intervalDays: integer("interval_days").notNull(),
    easeFactor: real("ease_factor").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("card_reviews_item").on(table.itemId), index("card_reviews_reviewed_at").on(table.reviewedAt)],
);

/** A multiple-choice question built only from approved items. Options are `QuizOption[]`. */
export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<QuizOption[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("quiz_questions_item").on(table.itemId)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => studySessions.id, { onDelete: "set null" }),
    chosenIndex: integer("chosen_index").notNull(),
    correct: boolean("correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("quiz_attempts_item").on(table.itemId), index("quiz_attempts_answered_at").on(table.answeredAt)],
);

export const sessionScope = pgEnum("session_scope", SESSION_SCOPES);

/** A focused, time-boxed study run over a tag, a source or everything. */
export const studySessions = pgTable("study_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: sessionScope("scope").notNull(),
  scopeValue: text("scope_value"),
  plannedMinutes: integer("planned_minutes").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

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
