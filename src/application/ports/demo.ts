import type { NewChunk, NewSource, SourceRecord } from "./study";

export interface DemoStore {
  /** Creates the demo source once, under a database lock, or returns the existing source. */
  ensureSource(source: NewSource, chunks: NewChunk[]): Promise<SourceRecord>;
}

export interface DemoExtraction {
  start(sourceId: string): boolean;
  whenIdle(sourceId: string): Promise<void>;
}
