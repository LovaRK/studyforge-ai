import type { LlmProvider } from "@/application/ports/llm";
import type { Env } from "@/config/env";
import { GeminiProvider } from "./gemini-provider";
import { MockLlmProvider } from "./mock-provider";

export function createLlmProvider(env: Pick<Env, "LLM_PROVIDER" | "GEMINI_API_KEY" | "GEMINI_MODEL">): LlmProvider {
  switch (env.LLM_PROVIDER) {
    case "gemini":
      // parseEnv guarantees both values are present for this provider.
      return new GeminiProvider({ apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL! });
    case "mock":
      return new MockLlmProvider();
  }
}
