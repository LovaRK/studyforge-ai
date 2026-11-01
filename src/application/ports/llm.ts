import type { z } from "zod";

export interface JsonRequest<T> {
  /** Stable instructions for the model. */
  system: string;
  /** The task input, e.g. a chunk of source text. */
  prompt: string;
  /** Every response is validated against this schema before it is returned. */
  schema: z.ZodType<T>;
}

/** Provider-neutral boundary for all model calls. */
export interface LlmProvider {
  readonly name: string;
  generateJson<T>(request: JsonRequest<T>): Promise<T>;
}

/** The provider asked us to slow down (HTTP 429). Callers back off and retry. */
export class LlmRateLimitError extends Error {
  constructor(readonly retryAfterMs: number | undefined) {
    super("LLM rate limit reached");
    this.name = "LlmRateLimitError";
  }
}

/** The provider answered, but not with valid JSON that matches the schema. */
export class LlmResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmResponseError";
  }
}
