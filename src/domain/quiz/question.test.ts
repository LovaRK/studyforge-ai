import { describe, expect, it } from "vitest";
import { buildQuestion } from "./question";
const candidates = Array.from({ length: 6 }, (_, i) => ({ id: String(i), question: `Question ${i}?`, answer: `Answer ${i}` }));
describe("reviewed quiz wording", () => {
  it("shuffles at most four distinct answers, retaining exactly one correct answer", () => {
    const q = buildQuestion(candidates[0]!, candidates, () => 0)!;
    expect(q.options).toHaveLength(4);
    expect(q.options.filter((o) => o.correct)).toEqual([{ text: "Answer 0", correct: true, provenance: "generated", itemId: "0" }]);
    expect(q.options[0]!.correct).toBe(false);
    expect(q.options.every((o) => candidates.some((c) => c.id === o.itemId && c.answer === o.text))).toBe(true);
  });
  it("does not offer duplicate answers or invent distractors", () => {
    expect(buildQuestion(candidates[0]!, [{ ...candidates[1]!, answer: " answer 0 " }])).toBeNull();
    expect(buildQuestion({ ...candidates[0]!, question: " " }, candidates)).toBeNull();
    expect(buildQuestion({ ...candidates[0]!, answer: " " }, candidates)).toBeNull();
  });
});
