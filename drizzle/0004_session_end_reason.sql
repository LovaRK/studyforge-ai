CREATE TYPE "public"."session_end_reason" AS ENUM('time', 'finished', 'empty');--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "end_reason" "session_end_reason";--> statement-breakpoint
-- Sessions that ended before this column existed: at the deadline means time ran out, otherwise the owner finished it.
UPDATE "study_sessions" SET "end_reason" = CASE
  WHEN "ended_at" >= "started_at" + make_interval(mins => "planned_minutes") THEN 'time'::"session_end_reason"
  ELSE 'finished'::"session_end_reason"
END WHERE "ended_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_end_reason" CHECK (("study_sessions"."ended_at" is null) = ("study_sessions"."end_reason" is null));