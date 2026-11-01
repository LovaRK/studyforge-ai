import { sourceTextFromPrompt } from "@/application/extraction/prompt";
import type { MockResponder } from "./mock-provider";

/**
 * Offline stand-in for the model, used in tests, CI and demos without a key.
 * It quotes up to four real sentences from the chunk, and adds one item with an
 * invented excerpt so the word-for-word check always has something to reject.
 */
export const demoResponder: MockResponder = ({ prompt }) => {
  const text = sourceTextFromPrompt(prompt);
  const sentences = (text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => s.split(" ").length >= 6 && !/[`{}=]/.test(s));

  const items = sentences.slice(0, 4).map((sentence, i) => {
    const title = sentence
      .split(" ")
      .slice(0, 5)
      .join(" ")
      .replace(/[,:;]$/, "");
    return {
      type: i === 0 ? "concept" : "term",
      title,
      summary: sentence,
      question: `What do the notes say about "${title}"?`,
      answer: sentence,
      excerpt: sentence,
      tags: ["demo"],
    };
  });

  items.push({
    type: "concept",
    title: "Invented claim",
    summary: "A claim the notes never make.",
    question: "Is this claim in the notes?",
    answer: "No.",
    excerpt: "This sentence was invented by the model and does not appear in the notes.",
    tags: ["demo"],
  });

  return { items };
};
