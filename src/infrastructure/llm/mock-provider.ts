import type { JsonRequest, LlmProvider } from "@/application/ports/llm";
import { parseJsonResponse } from "./parse-json";

export type MockResponder = (request: { system: string; prompt: string }) => unknown;

/**
 * Deterministic provider for tests, CI and offline demos. Responses still go
 * through the same JSON parsing and schema validation as a real provider.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";
  readonly calls: { system: string; prompt: string }[] = [];

  constructor(private readonly responder: MockResponder = () => ({})) {}

  async generateJson<T>(request: JsonRequest<T>): Promise<T> {
    this.calls.push({ system: request.system, prompt: request.prompt });
    const response = this.responder({ system: request.system, prompt: request.prompt });
    if (response instanceof Error) throw response;
    return parseJsonResponse(JSON.stringify(response), request.schema);
  }
}
