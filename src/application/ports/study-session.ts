import type { Grade, SessionEndReason, SessionScope } from "@/domain/study/types";

export interface StudySessionRecord {
  id: string;
  scope: SessionScope;
  scopeValue: string | null;
  plannedMinutes: number;
  startedAt: Date;
  endedAt: Date | null;
  /** Set together with endedAt. */
  endReason: SessionEndReason | null;
}

/** What happened in one session, read from the review and attempt logs. */
export interface SessionActivity {
  cards: Record<Grade, number>;
  quiz: { answered: number; correct: number };
  /** Items already studied in this session, so they are not shown twice. */
  seenItemIds: string[];
}

export interface StudySessionStore {
  start(session: { scope: SessionScope; scopeValue: string | null; plannedMinutes: number; startedAt: Date }): Promise<string>;
  get(id: string): Promise<StudySessionRecord | null>;
  /**
   * Ends the session once, with its reason. If it had already ended (another tab,
   * a concurrent request), nothing changes. Returns the session as stored.
   */
  end(id: string, endedAt: Date, reason: SessionEndReason): Promise<StudySessionRecord | null>;
  activity(id: string): Promise<SessionActivity>;
}
