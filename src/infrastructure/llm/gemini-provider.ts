import { LlmRateLimitError, LlmResponseError, type JsonRequest, type LlmProvider } from "@/application/ports/llm";
import { parseJsonResponse } from "./parse-json";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string; details?: { "@type"?: string; retryDelay?: string }[] };
};

/** Reads Google's RetryInfo delay ("12s" / "1.5s") from a 429 body. */
export function retryDelayMs(body: GeminiResponse): number | undefined {
  const delay = body.error?.details?.find((detail) => detail["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const seconds = delay ? Number.parseFloat(delay) : Number.NaN;
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined;
}

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini";

  constructor(
    private readonly options: { apiKey: string; model: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generateJson<T>(request: JsonRequest<T>): Promise<T> {
    const response = await this.fetchImpl(`${API_BASE}/models/${this.options.model}:generateContent`, {
      method: "POST",
      // Key goes in a header, never the URL, so it can't leak into access logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.options.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (response.status === 429) throw new LlmRateLimitError(retryDelayMs(body));
    if (!response.ok) {
      throw new LlmResponseError(`Gemini request failed (${response.status}): ${body.error?.message ?? "no details"}`);
    }

    const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!text) throw new LlmResponseError(`Gemini returned no text (finishReason: ${body.candidates?.[0]?.finishReason ?? "unknown"})`);
    return parseJsonResponse(text, request.schema);
  }
}
