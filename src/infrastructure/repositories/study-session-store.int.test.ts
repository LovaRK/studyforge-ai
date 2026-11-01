import { and, eq, isNotNull, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FlashcardError, makeFlashcards } from "@/application/flashcards/flashcards";
import { makeQuiz } from "@/application/quiz/quiz";
import { makeReview } from "@/application/review/review";
import { makeStudySessions, StudySessionError } from "@/application/study-session/study-session";
import { cardReviews, quizAttempts, quizQuestions, studySessions } from "@/infrastructure/db/schema";
import { connect, truncateAll } from "@/test/integration/database";
import { makeIngest, MEMORY_NOTE, pick, QUEUES_NOTE } from "@/test/integration/study";
import { DrizzleQuizStore } from "./drizzle-quiz-store";
import { DrizzleReviewStore } from "./drizzle-review-store";
import { DrizzleSrsStore } from "./drizzle-srs-store";
import { DrizzleStudySessionStore } from "./drizzle-study-session-store";

const { client, db } = connect();
const reviewStore = new DrizzleReviewStore(db);
const review = makeReview(reviewStore);
const ingest = makeIngest(db);
const START = new Date("2026-11-01T09:00:00Z");
let clock = START;
const now = () => clock;
const flashcards = makeFlashcards({ store: new DrizzleSrsStore(db), items: reviewStore, now });
const sessions = makeStudySessions({ store: new DrizzleStudySessionStore(db), flashcards, now });

async function approveAll() {
  const memory = await ingest("memory.md", MEMORY_NOTE);
  const queues = await ingest("queues.md", QUEUES_NOTE);
  await review.approve([...memory.items, ...queues.items].map((item) => item.id));
  return { memory, queues };
}

beforeEach(async () => {
  await truncateAll(db);
  clock = START;
});
afterAll(() => client.end());

describe("study sessions on Postgres", () => {
  it("serves each card in scope once, records grades against the session, and ends when nothing is left", async () => {
    const { queues } = await approveAll();
    const id = await sessions.start({ scope: "source", value: queues.source.id }, 15);

    const graded: string[] = [];
    for (const grade of ["good", "again"] as const) {
      const step = await sessions.next(id);
      expect(step.kind).toBe("card");
      if (step.kind !== "card") return;
      expect(step.endsAt).toEqual(new Date(START.getTime() + 15 * 60_000));
      expect(queues.items.map((i) => i.id)).toContain(step.card.itemId);
      expect(graded).not.toContain(step.card.itemId);
      graded.push(step.card.itemId);
      await flashcards.grade({ itemId: step.card.itemId, grade, version: step.card.version, sessionId: id });
      clock = new Date(clock.getTime() + 60_000);
    }

    // The Again card would be due again in 10 minutes, but a session shows each item once.
    clock = new Date(START.getTime() + 12 * 60_000);
    const done = await sessions.next(id);
    expect(done).toMatchObject({ kind: "done", reason: "empty", summary: { reviewed: 2 } });
    if (done.kind !== "done") return;
    expect(done.summary.activity.cards).toEqual({ again: 1, hard: 0, good: 1, easy: 0 });
    expect(new Set(done.summary.activity.seenItemIds)).toEqual(new Set(graded));
    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, id));
    expect(row!.endedAt).toEqual(clock);
    expect((await db.select().from(cardReviews)).every((r) => r.sessionId === id)).toBe(true);
    // Visiting the ended session again tells the same story.
    clock = new Date(START.getTime() + 13 * 60_000);
    expect(await sessions.next(id)).toMatchObject({ kind: "done", reason: "empty" });
  });

  it("ends at the planned time, even when the next step comes later", async () => {
    await approveAll();
    const id = await sessions.start({ scope: "all" }, 5);
    expect((await sessions.next(id)).kind).toBe("card");

    clock = new Date(START.getTime() + 60 * 60_000);
    expect(await sessions.next(id)).toMatchObject({ kind: "done", reason: "time" });
    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, id));
    expect(row!.endedAt).toEqual(new Date(START.getTime() + 5 * 60_000));
  });

  it("can be finished early, once", async () => {
    await approveAll();
    const id = await sessions.start({ scope: "tag", value: "demo" }, 25);
    clock = new Date(START.getTime() + 3 * 60_000);
    await sessions.finish(id);
    clock = new Date(START.getTime() + 4 * 60_000);
    await sessions.finish(id);

    expect(await sessions.next(id)).toMatchObject({ kind: "done", reason: "finished" });
    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, id));
    expect(row!.endedAt).toEqual(new Date(START.getTime() + 3 * 60_000));
  });

  it("counts quiz attempts made in the session and skips their items", async () => {
    const { memory } = await approveAll();
    const id = await sessions.start({ scope: "source", value: memory.source.id }, 10);
    const item = pick(memory.items, "weak reference");
    const [question] = await db
      .insert(quizQuestions)
      .values({ itemId: item.id, prompt: "Q?", options: [{ text: "A", correct: true, provenance: "generated" }] })
      .returning();
    await db.insert(quizAttempts).values({ questionId: question!.id, itemId: item.id, sessionId: id, chosenIndex: 0, correct: true });

    const step = await sessions.next(id);
    expect(step.summary).toMatchObject({ reviewed: 1, activity: { quiz: { answered: 1, correct: 1 }, seenItemIds: [item.id] } });
    expect(step.kind === "card" && step.card.itemId).not.toBe(item.id);
  });

  it("rejects invalid lengths, a tag or source scope without a value, and unknown sessions", async () => {
    await expect(sessions.start({ scope: "all" }, 0)).rejects.toThrow(StudySessionError);
    await expect(sessions.start({ scope: "all" }, 121)).rejects.toThrow(StudySessionError);
    await expect(sessions.start({ scope: "all" }, 2.5)).rejects.toThrow(StudySessionError);
    await expect(sessions.start({ scope: "tag" }, 10)).rejects.toThrow(StudySessionError);
    await expect(sessions.next("00000000-0000-4000-8000-000000000000")).rejects.toThrow(StudySessionError);
  });

  it("keeps its outcome on later visits, even when cards become due again", async () => {
    const { queues } = await approveAll();
    const id = await sessions.start({ scope: "source", value: queues.source.id }, 30);
    for (let i = 0; i < 2; i++) {
      const step = await sessions.next(id);
      if (step.kind !== "card") throw new Error("expected a card");
      await flashcards.grade({ itemId: step.card.itemId, grade: "again", version: step.card.version, sessionId: id });
    }
    expect(await sessions.next(id)).toMatchObject({ kind: "done", reason: "empty" });

    // Two days later both cards are due, but the session ended because nothing was left.
    clock = new Date(START.getTime() + 2 * 86_400_000);
    expect(await sessions.next(id)).toMatchObject({ kind: "done", reason: "empty", summary: { reviewed: 2 } });
    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, id));
    expect(row!.endReason).toBe("empty");
  });

  it("refuses answers after the deadline or after Finish, and leaves the summary as it was", async () => {
    await approveAll();
    const late = await sessions.start({ scope: "all" }, 5);
    const shown = await sessions.next(late);
    if (shown.kind !== "card") throw new Error("expected a card");

    // The tab stayed open past the deadline; the session has not been visited since.
    clock = new Date(START.getTime() + 6 * 60_000);
    await expect(
      flashcards.grade({ itemId: shown.card.itemId, grade: "good", version: shown.card.version, sessionId: late }),
    ).rejects.toThrow("This study session has ended");

    const finished = await sessions.start({ scope: "all" }, 30);
    const card = await sessions.next(finished);
    if (card.kind !== "card") throw new Error("expected a card");
    await sessions.finish(finished);
    await expect(
      flashcards.grade({ itemId: card.card.itemId, grade: "good", version: card.card.version, sessionId: finished }),
    ).rejects.toThrow(FlashcardError);

    expect(await db.select().from(cardReviews)).toEqual([]);
    expect(await sessions.next(finished)).toMatchObject({ kind: "done", reason: "finished", summary: { reviewed: 0 } });
  });

  it("refuses an item outside the session's selection, or one it already studied", async () => {
    const { memory, queues } = await approveAll();
    const id = await sessions.start({ scope: "source", value: queues.source.id }, 30);
    const outside = pick(memory.items, "weak reference");
    await expect(flashcards.grade({ itemId: outside.id, grade: "good", version: null, sessionId: id })).rejects.toThrow(FlashcardError);

    const step = await sessions.next(id);
    if (step.kind !== "card") throw new Error("expected a card");
    await flashcards.grade({ itemId: step.card.itemId, grade: "again", version: step.card.version, sessionId: id });
    // Ten minutes later the card is due again, with a new showing, but the session already studied it.
    clock = new Date(START.getTime() + 11 * 60_000);
    const [again] = await db.select({ at: cardReviews.reviewedAt }).from(cardReviews);
    await expect(
      flashcards.grade({ itemId: step.card.itemId, grade: "good", version: again!.at.toISOString(), sessionId: id }),
    ).rejects.toThrow(FlashcardError);
    expect(await db.select().from(cardReviews)).toHaveLength(1);
  });

  it("serialises answers with Finish: every recorded answer lands before the session ended", async () => {
    await approveAll();
    for (let round = 0; round < 5; round++) {
      const id = await sessions.start({ scope: "all" }, 30);
      const step = await sessions.next(id);
      if (step.kind !== "card") throw new Error("expected a card");
      clock = new Date(clock.getTime() + 1000);
      await Promise.allSettled([
        flashcards.grade({ itemId: step.card.itemId, grade: "good", version: step.card.version, sessionId: id }),
        sessions.finish(id),
      ]);
      const done = await sessions.next(id);
      const recorded = await db.select().from(cardReviews).where(eq(cardReviews.sessionId, id));
      expect(done).toMatchObject({ kind: "done", reason: "finished", summary: { reviewed: recorded.length } });
      // Reset the card so the next round can show it as new again.
      await db.execute(sql`truncate card_reviews, srs_cards`);
    }
  });

  it("stores an end reason exactly when the session has ended", async () => {
    const id = await sessions.start({ scope: "all" }, 5);
    await expect(db.update(studySessions).set({ endedAt: clock }).where(eq(studySessions.id, id))).rejects.toThrow();
    await sessions.finish(id);
    const ended = await db
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.id, id), isNotNull(studySessions.endReason)));
    expect(ended).toHaveLength(1);
  });

  it("mixes cards and quiz questions, each item once, and counts both in the summary", async () => {
    // The quiz store checks deadlines against the real clock, so this session starts now.
    clock = new Date();
    const quiz = makeQuiz({ store: new DrizzleQuizStore(db), random: () => 0 });
    const mixed = makeStudySessions({ store: new DrizzleStudySessionStore(db), flashcards, quiz, now });
    const { memory } = await approveAll();
    const id = await mixed.start({ scope: "source", value: memory.source.id }, 30);

    const studied: string[] = [];
    const kinds: string[] = [];
    for (;;) {
      const step = await mixed.next(id);
      if (step.kind === "done") {
        expect(step).toMatchObject({ reason: "empty", summary: { reviewed: 3, activity: { quiz: { answered: 1 } } } });
        break;
      }
      kinds.push(step.kind);
      if (step.kind === "card") {
        studied.push(step.card.itemId);
        await flashcards.grade({ itemId: step.card.itemId, grade: "good", version: step.card.version, sessionId: id });
      } else {
        studied.push(step.question.itemId);
        await quiz.answer(step.question.id, 0, id);
      }
    }
    expect(kinds).toEqual(["card", "quiz", "card"]);
    expect(new Set(studied)).toEqual(new Set(memory.items.map((item) => item.id)));
  });
});
