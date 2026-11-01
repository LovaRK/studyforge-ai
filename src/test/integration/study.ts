import { ExtractionRunner } from "@/application/extraction/extraction-runner";
import type { ItemView } from "@/application/ports/study";
import { importSource } from "@/application/sources/import-source";
import type { Database } from "@/infrastructure/db/client";
import { demoResponder } from "@/infrastructure/llm/demo-responder";
import { MockLlmProvider } from "@/infrastructure/llm/mock-provider";
import { createLogger } from "@/infrastructure/logging/logger";
import { DrizzleExtractionStore, DrizzleLlmCache } from "@/infrastructure/repositories/drizzle-extraction-store";
import { DrizzleReviewStore } from "@/infrastructure/repositories/drizzle-review-store";
import { DrizzleSourceStore } from "@/infrastructure/repositories/drizzle-source-store";
import { DocumentTextExtractor } from "@/infrastructure/text/document-text-extractor";

export const MEMORY_NOTE = `# Memory

Automatic Reference Counting frees an instance once nothing holds a strong reference to it.
A weak reference does not keep the instance alive and becomes nil when it is freed.
An unowned reference also skips the retain but must never outlive its target.`;

export const QUEUES_NOTE = `# Queues

Grand Central Dispatch runs work items on queues that the system manages for you.
The main queue is serial, so user interface updates should always be sent to it.`;

/** Imports a note, extracts it with the offline model, and returns the source and its pending items. */
export function makeIngest(db: Database) {
  const sources = new DrizzleSourceStore(db);
  const reviewStore = new DrizzleReviewStore(db);
  return async function ingest(name: string, text: string) {
    const source = await importSource(
      { sources, extractor: new DocumentTextExtractor() },
      { file: { name, mimeType: "text/markdown", bytes: new TextEncoder().encode(text) } },
    );
    const runner = new ExtractionRunner({
      sources,
      store: new DrizzleExtractionStore(db),
      cache: new DrizzleLlmCache(db),
      llm: new MockLlmProvider(demoResponder),
      model: "mock",
      logger: createLogger({}, () => {}),
      options: { requestsPerMinute: 0 },
    });
    runner.start(source.id);
    await runner.whenIdle(source.id);
    return { source, items: await reviewStore.listQueue({ sourceId: source.id }) };
  };
}

/** The item quoting `words`. Items from one chunk share a timestamp, so queue order is not stable. */
export function pick(items: ItemView[], words: string): ItemView {
  const found = items.find((item) => item.excerpts.some((e) => e.text.includes(words)));
  if (!found) throw new Error(`No item quotes "${words}"`);
  return found;
}
