import type { z } from "zod";
import { LlmResponseError } from "@/application/ports/llm";

/** Parses model text as JSON (tolerating a ```json fence) and validates it. */
export function parseJsonResponse<T>(text: string, schema: z.ZodType<T>): T {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let data: unknown;
  try {
    data = JSON.parse(unfenced);
  } catch {
    throw new LlmResponseError("Model response was not valid JSON");
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");
    throw new LlmResponseError(`Model response did not match the expected shape at: ${paths}`);
  }
  return result.data;
}
