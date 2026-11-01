CREATE TYPE "public"."chunk_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('pending', 'approved', 'discarded', 'merged');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('concept', 'term', 'system', 'process', 'how_to', 'question');--> statement-breakpoint
CREATE TYPE "public"."review_action" AS ENUM('approve', 'edit', 'merge', 'tag', 'discard');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"heading" text,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"word_count" integer NOT NULL,
	"status" "chunk_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "item_excerpts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"text" text NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_id" uuid,
	"type" "item_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" "item_status" DEFAULT 'pending' NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"merged_into_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "llm_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rejected_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"action" "review_action" NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"attribution" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"text" text NOT NULL,
	"word_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_excerpts" ADD CONSTRAINT "item_excerpts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_excerpts" ADD CONSTRAINT "item_excerpts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejected_extractions" ADD CONSTRAINT "rejected_extractions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejected_extractions" ADD CONSTRAINT "rejected_extractions_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_source_ordinal" ON "chunks" USING btree ("source_id","ordinal");--> statement-breakpoint
CREATE INDEX "item_excerpts_item" ON "item_excerpts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "items_status_created" ON "items" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "items_source" ON "items" USING btree ("source_id");