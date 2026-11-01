import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, extractionResponseSchema } from "@/application/extraction/prompt";
import { verifyExtractedItems } from "@/application/extraction/verify-items";
import { demoResponder } from "./demo-responder";

describe("demoResponder", () => {
  it("returns valid output where real quotes pass the check and the invented one fails", () => {
    const text = "Value types are copied when assigned to a new variable. Reference types share a single instance between variables.";
    const response = extractionResponseSchema.parse(
      demoResponder({ system: "", prompt: buildExtractionPrompt({ sourceTitle: "T", chunkText: text }) }),
    );
    const { verified, rejected } = verifyExtractedItems(response.items, { id: "s", text }, { start: 0, end: text.length });

    expect(verified).toHaveLength(2);
    expect(rejected).toHaveLength(1);
  });
});
