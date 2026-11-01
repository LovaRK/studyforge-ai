import { createHash } from "node:crypto";
import { LlmRateLimitError, type LlmProvider } from "@/application/ports/llm";
import type { ChunkRecord, ExtractionStore, LlmCache, SourceRecord, SourceStore } from "@/application/ports/study";
import type { Logger } from "@/application/ports/logger";
import { buildExtractionPrompt, EXTRACTION_PROMPT_VERSION, EXTRACTION_SYSTEM_PROMPT, extractionResponseSchema, type ExtractedItem } from "./prompt";
import { verifyExtractedItems } from "./verify-items";

export interface ExtractionRunnerOptions {
  /** Free tiers allow roughly 5–15 requests a minute; calls are spaced to stay under this. */
  requestsPerMinute: number;
  /** Attempts per chunk, including retries after rate limits. */
  maxAttempts: number;
  /** First backoff delay; doubles on every retry, capped at maxBackoffMs. */
  baseBackoffMs: number;
  maxBackoffMs: number;
}

export interface ExtractionRunnerDeps {
  sources: SourceStore;
  store: ExtractionStore;
  cache: LlmCache;
  llm: LlmProvider;
  model: string;
  logger: Logger;
  options?: Partial<ExtractionRunnerOptions>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const DEFAULTS: ExtractionRunnerOptions = { requestsPerMinute: 10, maxAttempts: 5, baseBackoffMs: 2_000, maxBackoffMs: 60_000 };

export function extractionCacheKey(parts: { provider: string; model: string; text: string }): string {
  const digest = createHash("sha256").update(parts.text).digest("hex");
  return `${parts.provider}:${parts.model}:${EXTRACTION_PROMPT_VERSION}:${digest}`;
}

/**
 * Processes a source's chunks one at a time in this server process: throttled,
 * retried with exponential backoff on 429s, cached by chunk hash, and resumable
 * because progress lives in the database, not in memory.
 */
export class ExtractionRunner {
  private readonly running = new Map<string, Promise<void>>();
  private readonly options: ExtractionRunnerOptions;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private lastCallAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly deps: ExtractionRunnerDeps) {
    this.options = { ...DEFAULTS, ...deps.options };
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = deps.now ?? Date.now;
  }

  isRunning(sourceId: string): boolean {
    return this.running.has(sourceId);
  }

  /** Starts (or resumes) extraction in the background. Returns false if it is already running. */
  start(sourceId: string): boolean {
    if (this.running.has(sourceId)) return false;
    const run = this.run(sourceId)
      .catch((error: unknown) => this.deps.logger.error("extraction run crashed", { sourceId, error }))
      .finally(() => this.running.delete(sourceId));
    this.running.set(sourceId, run);
    return true;
  }

  /** Resolves when the current run for this source (if any) finishes. */
  async whenIdle(sourceId: string): Promise<void> {
    await this.running.get(sourceId);
  }

  private async run(sourceId: string): Promise<void> {
    const source = await this.deps.sources.findById(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);
    const log = this.deps.logger.child({ sourceId });

    for (const chunk of await this.deps.store.chunksToProcess(sourceId)) {
      await this.deps.store.markProcessing(chunk.id);
      try {
        await this.processChunk(source, chunk);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.deps.store.markFailed(chunk.id, message);
        log.warn("chunk failed", { chunk: chunk.ordinal, error: message });
        // Still rate-limited after every retry: the quota is spent, so stop and let the owner resume later.
        if (error instanceof LlmRateLimitError) return;
      }
    }
    log.info("extraction run finished");
  }

  private async processChunk(source: SourceRecord, chunk: ChunkRecord): Promise<void> {
    const text = source.text.slice(chunk.start, chunk.end);
    const key = extractionCacheKey({ provider: this.deps.llm.name, model: this.deps.model, text });

    let items: ExtractedItem[];
    const cached = extractionResponseSchema.safeParse(await this.deps.cache.get(key));
    if (cached.success) {
      items = cached.data.items;
    } else {
      const response = await this.callWithBackoff(() =>
        this.deps.llm.generateJson({
          system: EXTRACTION_SYSTEM_PROMPT,
          prompt: buildExtractionPrompt({ sourceTitle: source.title, chunkText: text }),
          schema: extractionResponseSchema,
        }),
      );
      await this.deps.cache.set(key, { provider: this.deps.llm.name, model: this.deps.model, response });
      items = response.items;
    }

    const { verified, rejected } = verifyExtractedItems(items, source, chunk);
    await this.deps.store.saveChunkResult(chunk, verified, rejected);
    this.deps.logger.info("chunk extracted", { sourceId: source.id, chunk: chunk.ordinal, verified: verified.length, rejected: rejected.length });
  }

  private async callWithBackoff<T>(call: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await this.throttle();
      try {
        return await call();
      } catch (error) {
        if (attempt >= this.options.maxAttempts) throw error;
        const backoff = Math.min(this.options.baseBackoffMs * 2 ** (attempt - 1), this.options.maxBackoffMs);
        const delay = error instanceof LlmRateLimitError ? Math.max(error.retryAfterMs ?? 0, backoff) : backoff;
        this.deps.logger.warn("llm call failed, retrying", { attempt, delayMs: delay, error });
        await this.sleep(delay);
      }
    }
  }

  private async throttle(): Promise<void> {
    if (this.options.requestsPerMinute <= 0) return;
    const interval = 60_000 / this.options.requestsPerMinute;
    const wait = this.lastCallAt + interval - this.now();
    if (wait > 0) await this.sleep(wait);
    this.lastCallAt = this.now();
  }
}
