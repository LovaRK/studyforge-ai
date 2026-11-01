import type { SessionScope, Grade } from "@/domain/study/types";

export interface StudySessionRecord {
  id: string;
  scope: SessionScope;
  scopeValue: string | null;
  plannedMinutes: number;
  startedAt: Date;
  endedAt: Date | null;
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
  /** Sets endedAt once; later calls change nothing. */
  end(id: string, endedAt: Date): Promise<void>;
  activity(id: string): Promise<SessionActivity>;
}
