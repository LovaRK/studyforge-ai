import { describe, expect, it } from "vitest";
import type { FlashcardView } from "@/application/flashcards/flashcards";
import type { StudyScope } from "@/application/ports/flashcards";
import type { StudySessionRecord, StudySessionStore } from "@/application/ports/study-session";
import { makeStudySessions, StudySessionError } from "./study-session";

const START = new Date("2026-11-01T09:00:00Z");
const minutes = (n: number) => new Date(START.getTime() + n * 60_000);
const card = { itemId: "i1" } as FlashcardView;

function setup(options: { cardsLeft: boolean }) {
  const state = { cardsLeft: options.cardsLeft };
  let clock = START;
  const sessions = new Map<string, StudySessionRecord>();
  const calls: { scope: StudyScope; exclude: string[] }[] = [];
  const store: StudySessionStore = {
    async start(session) {
      sessions.set("s1", { ...session, id: "s1", endedAt: null, endReason: null });
      return "s1";
    },
    get: async (id) => sessions.get(id) ?? null,
    async end(id, endedAt, reason) {
      const session = sessions.get(id)!;
      if (!session.endedAt) Object.assign(session, { endedAt, endReason: reason });
      return { ...session };
    },
    activity: async () => ({ cards: { again: 0, hard: 0, good: 1, easy: 0 }, quiz: { answered: 2, correct: 1 }, seenItemIds: ["seen"] }),
  };
  const flashcards = {
    async next(scope: StudyScope, exclude: string[] = []) {
      calls.push({ scope, exclude });
      return { card: state.cardsLeft ? card : null, counts: { due: 0, new: 0, reviewedSince: 0, nextDueAt: null } };
    },
  };
  const api = makeStudySessions({ store, flashcards, now: () => clock });
  return { api, sessions, calls, state, at: (date: Date) => (clock = date) };
}

describe("study sessions", () => {
  it("serves cards in the session's scope, excluding what it already studied", async () => {
    const { api, calls } = setup({ cardsLeft: true });
    const id = await api.start({ scope: "tag", value: "swift" }, 10);
    const step = await api.next(id);
    expect(step).toMatchObject({ kind: "card", card, endsAt: minutes(10), summary: { reviewed: 3 } });
    expect(calls).toEqual([{ scope: { scope: "tag", value: "swift" }, exclude: ["seen"] }]);
  });

  it("ends at the planned time even when asked later, and says so on every visit", async () => {
    const { api, sessions, at } = setup({ cardsLeft: true });
    const id = await api.start({ scope: "all" }, 5);
    at(minutes(30));
    expect(await api.next(id)).toMatchObject({ kind: "done", reason: "time" });
    expect(sessions.get(id)!.endedAt).toEqual(minutes(5));
    expect(await api.next(id)).toMatchObject({ kind: "done", reason: "time" });
  });

  it("ends when nothing is left, and tells an early finish apart from running out", async () => {
    const empty = setup({ cardsLeft: false });
    const id = await empty.api.start({ scope: "all" }, 15);
    empty.at(minutes(2));
    expect(await empty.api.next(id)).toMatchObject({ kind: "done", reason: "empty" });
    // Cards becoming due later does not rewrite how the session ended.
    empty.state.cardsLeft = true;
    expect(await empty.api.next(id)).toMatchObject({ kind: "done", reason: "empty" });

    const early = setup({ cardsLeft: true });
    const other = await early.api.start({ scope: "all" }, 15);
    await early.api.finish(other);
    expect(await early.api.next(other)).toMatchObject({ kind: "done", reason: "finished" });
    early.state.cardsLeft = false;
    expect(await early.api.next(other)).toMatchObject({ kind: "done", reason: "finished" });
  });

  it("validates the length and the scope", async () => {
    const { api } = setup({ cardsLeft: true });
    for (const bad of [0, 121, 1.5]) await expect(api.start({ scope: "all" }, bad)).rejects.toThrow(StudySessionError);
    await expect(api.start({ scope: "source" }, 10)).rejects.toThrow("Choose a tag or a source.");
    // Tags the quiz would refuse would make every quiz step of the session fail.
    for (const value of ["   ", "x".repeat(41)])
      await expect(api.start({ scope: "tag", value }, 10)).rejects.toThrow("Choose a tag or a source.");
    await expect(api.start({ scope: "source", value: "not-a-uuid" }, 10)).rejects.toThrow("Choose a tag or a source.");
    await expect(api.next("missing")).rejects.toThrow(StudySessionError);
  });

  const question = { id: "q1", itemId: "i2", prompt: "P?", options: [] };
  function mixed() {
    const state = { reviewed: 0, card: { ...card, isNew: true } as FlashcardView | null, questions: true };
    const quizCalls: string[][] = [];
    const api = makeStudySessions({
      store: {
        start: async () => "s1",
        get: async () => ({
          id: "s1",
          scope: "all",
          scopeValue: null,
          plannedMinutes: 30,
          startedAt: START,
          endedAt: null,
          endReason: null,
        }),
        end: async () => null,
        activity: async () => ({
          cards: { again: 0, hard: 0, good: state.reviewed, easy: 0 },
          quiz: { answered: 0, correct: 0 },
          seenItemIds: ["seen"],
        }),
      },
      flashcards: { next: async () => ({ card: state.card, counts: { due: 0, new: 0, reviewedSince: 0, nextDueAt: null } }) },
      quiz: {
        async nextQuestion(_scope, exclude = []) {
          quizCalls.push(exclude);
          return state.questions ? question : null;
        },
      },
      now: () => START,
    });
    return { api, state, quizCalls };
  }

  it("alternates new cards and quiz questions, and lets either continue when the other runs out", async () => {
    const { api, state, quizCalls } = mixed();
    expect((await api.next("s1")).kind).toBe("card");
    state.reviewed = 1;
    expect(await api.next("s1")).toMatchObject({ kind: "quiz", question });
    expect(quizCalls.at(-1)).toEqual(["seen", "i1"]);
    state.questions = false;
    expect((await api.next("s1")).kind).toBe("card");
    state.reviewed = 2;
    state.card = null;
    state.questions = true;
    expect((await api.next("s1")).kind).toBe("quiz");
    state.questions = false;
    expect(await api.next("s1")).toMatchObject({ kind: "done", reason: "empty" });
  });

  it("shows every due card before a quiz question can use up its item", async () => {
    const { api, state, quizCalls } = mixed();
    state.card = { ...card, isNew: false };
    for (const reviewed of [0, 1, 2, 3]) {
      state.reviewed = reviewed;
      expect((await api.next("s1")).kind).toBe("card");
    }
    expect(quizCalls).toEqual([]);
  });
});
