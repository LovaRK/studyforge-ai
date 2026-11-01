import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LlmRateLimitError, LlmResponseError } from "@/application/ports/llm";
import { GeminiProvider, retryDelayMs } from "./gemini-provider";
import { MockLlmProvider } from "./mock-provider";
import { parseJsonResponse } from "./parse-json";

const schema = z.object({ items: z.array(z.object({ term: z.string() })) });
const request = { system: "Extract terms.", prompt: "Swift structs are value types.", schema };

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("parseJsonResponse", () => {
  it("parses fenced JSON", () => {
    expect(parseJsonResponse('```json\n{"items":[]}\n```', schema)).toEqual({ items: [] });
  });

  it("rejects invalid JSON and wrong shapes", () => {
    expect(() => parseJsonResponse("not json", schema)).toThrow(LlmResponseError);
    expect(() => parseJsonResponse('{"items":[{"term":1}]}', schema)).toThrow(/items.0.term/);
  });
});

describe("MockLlmProvider", () => {
  it("returns validated canned output and records calls", async () => {
    const provider = new MockLlmProvider(() => ({ items: [{ term: "value type" }] }));
    expect(await provider.generateJson(request)).toEqual({ items: [{ term: "value type" }] });
    expect(provider.calls).toHaveLength(1);
  });

  it("can simulate provider errors", async () => {
    const provider = new MockLlmProvider(() => new LlmRateLimitError(1000));
    await expect(provider.generateJson(request)).rejects.toBeInstanceOf(LlmRateLimitError);
  });
});

describe("GeminiProvider", () => {
  const options = { apiKey: "test-key", model: "test-model" };

  it("sends the key in a header and parses the JSON answer", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(200, { candidates: [{ content: { parts: [{ text: '{"items":[{"term":"COW"}]}' }] } }] }));
    const provider = new GeminiProvider(options, fetchMock);

    expect(await provider.generateJson(request)).toEqual({ items: [{ term: "COW" }] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/models/test-model:generateContent");
    expect(String(url)).not.toContain("test-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("turns 429 into a rate-limit error with the server's retry delay", async () => {
    const body = { error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "12s" }] } };
    const provider = new GeminiProvider(options, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(429, body)));

    await expect(provider.generateJson(request)).rejects.toMatchObject({ name: "LlmRateLimitError", retryAfterMs: 12_000 });
    expect(retryDelayMs({})).toBeUndefined();
  });

  it("reports other failures and empty answers", async () => {
    const failing = new GeminiProvider(options, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(500, { error: { message: "boom" } })));
    await expect(failing.generateJson(request)).rejects.toThrow(/500.*boom/);

    const empty = new GeminiProvider(options, vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(200, { candidates: [] })));
    await expect(empty.generateJson(request)).rejects.toBeInstanceOf(LlmResponseError);
  });
});
