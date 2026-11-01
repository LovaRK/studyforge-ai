import type { Flashcards, FlashcardView } from "@/application/flashcards/flashcards";
import type { StudyScope } from "@/application/ports/flashcards";
import type { SessionActivity, StudySessionRecord, StudySessionStore } from "@/application/ports/study-session";
import { UserFacingError } from "@/application/errors";
import { quizScopeSchema, type Quiz, type QuizQuestionView } from "@/application/quiz/quiz";

export const SESSION_MINUTES = { min: 1, max: 120 } as const;

export class StudySessionError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "StudySessionError";
  }
}

export interface SessionSummary {
  session: StudySessionRecord;
  activity: SessionActivity;
  reviewed: number;
}

export type SessionStep =
  | { kind: "card"; card: FlashcardView; endsAt: Date; summary: SessionSummary }
  | { kind: "quiz"; question: QuizQuestionView; endsAt: Date; summary: SessionSummary }
  | { kind: "done"; reason: "time" | "finished" | "empty"; summary: SessionSummary };

interface Deps {
  store: StudySessionStore;
  flashcards: Pick<Flashcards, "next">;
  /** Without a quiz, sessions are cards only. */
  quiz?: Pick<Quiz, "nextQuestion">;
  now?: () => Date;
}

/**
 * A focused, time-boxed run over everything, one tag or one source. Due flashcards
 * come first, so a quiz question never uses up an item whose review is due; then new
 * flashcards alternate with quiz questions. Each step is about an item not yet studied
 * in this session, and when one kind runs out the other continues. The session ends when its time is up, when nothing is left, or when
 * the owner finishes it.
 */
export function makeStudySessions({ store, flashcards, quiz, now = () => new Date() }: Deps) {
  async function summarize(session: StudySessionRecord): Promise<SessionSummary> {
    const activity = await store.activity(session.id);
    const reviewed = Object.values(activity.cards).reduce((a, b) => a + b, 0) + activity.quiz.answered;
    return { session, activity, reviewed };
  }

  async function load(id: string): Promise<StudySessionRecord> {
    const session = await store.get(id);
    if (!session) throw new StudySessionError("This study session does not exist.");
    return session;
  }

  return {
    async start(scope: StudyScope, plannedMinutes: number): Promise<string> {
      if (!Number.isInteger(plannedMinutes) || plannedMinutes < SESSION_MINUTES.min || plannedMinutes > SESSION_MINUTES.max) {
        throw new StudySessionError(`Choose between ${SESSION_MINUTES.min} and ${SESSION_MINUTES.max} minutes.`);
      }
      // The same rules the quiz applies, so every session it starts can show questions.
      const valid = quizScopeSchema.safeParse(scope);
      if (!valid.success) throw new StudySessionError("Choose a tag or a source.");
      const checked = valid.data;
      return store.start({
        scope: checked.scope,
        scopeValue: checked.scope === "all" ? null : checked.value,
        plannedMinutes,
        startedAt: now(),
      });
    },

    async next(id: string): Promise<SessionStep> {
      const session = await load(id);
      const at = now();
      const endsAt = new Date(session.startedAt.getTime() + session.plannedMinutes * 60_000);
      const summary = await summarize(session);
      // The outcome is stored when the session ends, so a later visit always tells the same story.
      if (session.endedAt) return { kind: "done", reason: session.endReason!, summary };

      const done = async (reason: "time" | "empty") => {
        const ended = (await store.end(id, reason === "time" ? endsAt : at, reason)) ?? session;
        // A concurrent request may have ended it first; its reason and activity stand.
        return { kind: "done" as const, reason: ended.endReason ?? reason, summary: await summarize(ended) };
      };
      if (at >= endsAt) return done("time");

      const scope: StudyScope =
        session.scope === "all" ? { scope: "all" } : { scope: session.scope, value: session.scopeValue ?? undefined };
      const seen = summary.activity.seenItemIds;
      const { card } = await flashcards.next(scope, seen);
      // A due card always comes first; after that, odd steps (or no card left) try a question.
      if (card && (!card.isNew || summary.reviewed % 2 === 0)) return { kind: "card", card, endsAt, summary };
      const question = quiz ? await quiz.nextQuestion(scope, seen) : null;
      if (question) return { kind: "quiz", question, endsAt, summary };
      return card ? { kind: "card", card, endsAt, summary } : done("empty");
    },

    async finish(id: string): Promise<void> {
      await load(id);
      await store.end(id, now(), "finished");
    },
  };
}

export type StudySessions = ReturnType<typeof makeStudySessions>;
