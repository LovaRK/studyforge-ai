import { expect, it, vi } from "vitest";
import type { QuizStore } from "@/application/ports/quiz";
import { makeQuiz } from "./quiz";
const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
function setup() {
  const store: QuizStore = {
    candidates: vi.fn(async () => ids.map((id, i) => ({ id, question: `Q${i}`, answer: `A${i}` }))),
    save: vi.fn(async (q) => ({ ...q, id: ids[0]! })),
    answer: vi.fn(),
  };
  return { store, quiz: makeQuiz({ store, random: () => 0 }) };
}
it("excludes item ids while still allowing their approved wording as distractors", async () => {
  const { quiz } = setup();
  const q = await quiz.nextQuestion({ scope: "all" }, [ids[0]!]);
  expect(q!.itemId).toBe(ids[1]);
  expect(q!.options).toHaveLength(2);
  expect(q!.options.every((o) => Object.keys(o).sort().join() === "provenance,text")).toBe(true);
  expect(q).not.toHaveProperty("excerpts");
  expect(await quiz.nextQuestion({ scope: "all" }, ids)).toBeNull();
});
it("validates scope and answers before calling the store", async () => {
  const { quiz, store } = setup();
  await expect(quiz.nextQuestion({ scope: "tag", value: " " })).rejects.toThrow();
  expect(() => quiz.answer(ids[0]!, -1)).toThrow();
  expect(() => quiz.answer("bad", 0)).toThrow();
  expect(store.answer).not.toHaveBeenCalled();
});
