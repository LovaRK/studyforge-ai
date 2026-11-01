import type { Excerpt, GeneratedFields, ItemStatus, ItemType, ReviewAction } from "@/domain/items/item";

export interface NewSource {
  title: string;
  attribution: string | null;
  fileName: string;
  mimeType: string;
  text: string;
  wordCount: number;
}

export interface NewChunk {
  ordinal: number;
  heading: string | null;
  start: number;
  end: number;
  wordCount: number;
}

export interface SourceRecord extends NewSource {
  id: string;
  createdAt: Date;
}

export interface ExtractionProgress {
  totalChunks: number;
  doneChunks: number;
  failedChunks: number;
  processingChunks: number;
  pendingItems: number;
  approvedItems: number;
  rejectedItems: number;
}

export interface SourceSummary extends ExtractionProgress {
  id: string;
  title: string;
  attribution: string | null;
  fileName: string;
  wordCount: number;
  createdAt: Date;
}

export interface SourceStore {
  create(source: NewSource, chunks: NewChunk[]): Promise<SourceRecord>;
  findById(id: string): Promise<SourceRecord | null>;
  list(): Promise<SourceSummary[]>;
  progress(sourceId: string): Promise<ExtractionProgress>;
}

export interface ChunkRecord {
  id: string;
  sourceId: string;
  ordinal: number;
  start: number;
  end: number;
  attempts: number;
}

/** An extracted item whose excerpt passed the word-for-word check. */
export interface VerifiedItem extends GeneratedFields {
  tags: string[];
  excerpt: Excerpt;
}

export interface RejectedItem {
  type: string;
  title: string;
  excerpt: string;
  reason: "excerpt_not_found";
}

export interface RejectedRecord extends RejectedItem {
  id: string;
  createdAt: Date;
}

export interface ExtractionStore {
  /** Chunks still to do (pending, failed, or left processing by a stopped run), in order. */
  chunksToProcess(sourceId: string): Promise<ChunkRecord[]>;
  markProcessing(chunkId: string): Promise<void>;
  markFailed(chunkId: string, error: string): Promise<void>;
  /** Stores verified items and rejections and marks the chunk done, atomically. */
  saveChunkResult(chunk: ChunkRecord, verified: VerifiedItem[], rejected: RejectedItem[]): Promise<void>;
  listRejected(sourceId: string): Promise<RejectedRecord[]>;
}

export interface LlmCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, entry: { provider: string; model: string; response: unknown }): Promise<void>;
}

export interface QueueFilter {
  type?: ItemType;
  tag?: string;
  sourceId?: string;
}

export interface ItemView extends GeneratedFields {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceAttribution: string | null;
  tags: string[];
  status: ItemStatus;
  edited: boolean;
  createdAt: Date;
  excerpts: Excerpt[];
}

export interface ReviewStore {
  listQueue(filter: QueueFilter): Promise<ItemView[]>;
  queueTags(): Promise<string[]>;
  getItem(id: string): Promise<ItemView | null>;
  /** Sets status on pending items only and records one event per item. Returns the ids changed. */
  setStatus(ids: string[], status: "approved" | "discarded", action: ReviewAction): Promise<string[]>;
  updateFields(id: string, fields: GeneratedFields): Promise<void>;
  setTags(id: string, tags: string[]): Promise<void>;
  /** Creates one pending item holding every excerpt of the merged items; marks those as merged. */
  merge(ids: string[], fields: GeneratedFields & { tags: string[] }): Promise<string>;
}
