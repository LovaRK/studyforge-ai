CREATE TYPE "public"."grade" AS ENUM('again', 'hard', 'good', 'easy');--> statement-breakpoint
CREATE TYPE "public"."session_scope" AS ENUM('all', 'tag', 'source');--> statement-breakpoint
CREATE TABLE "card_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"session_id" uuid,
	"grade" "grade" NOT NULL,
	"interval_days" integer NOT NULL,
	"ease_factor" real NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_search" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"document" "tsvector" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"session_id" uuid,
	"chosen_index" integer NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "srs_cards" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "session_scope" NOT NULL,
	"scope_value" text,
	"planned_minutes" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_search" ADD CONSTRAINT "item_search_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "srs_cards" ADD CONSTRAINT "srs_cards_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_reviews_item" ON "card_reviews" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "card_reviews_reviewed_at" ON "card_reviews" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "item_search_document" ON "item_search" USING gin ("document");--> statement-breakpoint
CREATE INDEX "quiz_attempts_item" ON "quiz_attempts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_answered_at" ON "quiz_attempts" USING btree ("answered_at");--> statement-breakpoint
CREATE INDEX "quiz_questions_item" ON "quiz_questions" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "srs_cards_due" ON "srs_cards" USING btree ("due_at");