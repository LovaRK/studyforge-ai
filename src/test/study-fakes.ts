import {
  ItemNotPendingError,
  type ChunkRecord,
  type ExtractionProgress,
  type ExtractionStore,
  type ItemView,
  type LlmCache,
  type MergeCandidate,
  type NewChunk,
  type NewSource,
  type QueueFilter,
  type RejectedItem,
  type RejectedRecord,
  type ReviewStore,
  type SourceRecord,
  type SourceStore,
  type SourceSummary,
  type VerifiedItem,
} from "@/application/ports/study";
import type { GeneratedFields, ReviewAction } from "@/domain/items/item";

type ChunkRow = ChunkRecord & { status: "pending" | "processing" | "done" | "failed"; lastError: string | null };

/** One in-memory database backing every study port, for use-case tests. */
export class InMemoryStudyDb implements SourceStore, ExtractionStore, LlmCache, ReviewStore {
  sources: SourceRecord[] = [];
  chunks: ChunkRow[] = [];
  items: ItemView[] = [];
  rejected: (RejectedRecord & { sourceId: string })[] = [];
  events: { itemId: string; action: ReviewAction }[] = [];
  cache = new Map<string, unknown>();
  private seq = 0;

  private id(prefix: string) {
    return `${prefix}-${++this.seq}`;
  }

  // SourceStore
  async create(source: NewSource, chunks: NewChunk[]): Promise<SourceRecord> {
    const record = { ...source, id: this.id("source"), createdAt: new Date() };
    this.sources.push(record);
    for (const c of chunks) {
      this.chunks.push({
        id: this.id("chunk"),
        sourceId: record.id,
        ordinal: c.ordinal,
        start: c.start,
        end: c.end,
        attempts: 0,
        status: "pending",
        lastError: null,
      });
    }
    return record;
  }

  async findById(id: string) {
    return this.sources.find((s) => s.id === id) ?? null;
  }

  async list(): Promise<SourceSummary[]> {
    return Promise.all(this.sources.map(async (s) => ({ ...s, ...(await this.progress(s.id)) })));
  }

  async progress(sourceId: string): Promise<ExtractionProgress> {
    const chunks = this.chunks.filter((c) => c.sourceId === sourceId);
    const items = this.items.filter((i) => i.sourceId === sourceId);
    return {
      totalChunks: chunks.length,
      doneChunks: chunks.filter((c) => c.status === "done").length,
      failedChunks: chunks.filter((c) => c.status === "failed").length,
      processingChunks: chunks.filter((c) => c.status === "processing").length,
      pendingItems: items.filter((i) => i.status === "pending").length,
      approvedItems: items.filter((i) => i.status === "approved").length,
      rejectedItems: this.rejected.filter((r) => r.sourceId === sourceId).length,
    };
  }

  // ExtractionStore
  async chunksToProcess(sourceId: string) {
    return this.chunks.filter((c) => c.sourceId === sourceId && c.status !== "done").sort((a, b) => a.ordinal - b.ordinal);
  }

  async markProcessing(chunkId: string) {
    const chunk = this.chunks.find((c) => c.id === chunkId)!;
    chunk.status = "processing";
    chunk.attempts += 1;
  }

  async markFailed(chunkId: string, error: string) {
    const chunk = this.chunks.find((c) => c.id === chunkId)!;
    chunk.status = "failed";
    chunk.lastError = error;
  }

  async saveChunkResult(chunk: ChunkRecord, verified: VerifiedItem[], rejected: RejectedItem[]) {
    const source = (await this.findById(chunk.sourceId))!;
    for (const v of verified) {
      this.items.push({
        id: this.id("item"),
        sourceId: chunk.sourceId,
        sourceTitle: source.title,
        sourceAttribution: source.attribution,
        type: v.type,
        title: v.title,
        summary: v.summary,
        question: v.question,
        answer: v.answer,
        tags: v.tags,
        status: "pending",
        edited: false,
        createdAt: new Date(),
        excerpts: [{ ...v.excerpt, sourceTitle: source.title, sourceAttribution: source.attribution }],
      });
    }
    for (const r of rejected) this.rejected.push({ ...r, id: this.id("rejected"), sourceId: chunk.sourceId, createdAt: new Date() });
    this.chunks.find((c) => c.id === chunk.id)!.status = "done";
  }

  async listRejected(sourceId: string) {
    return this.rejected.filter((r) => r.sourceId === sourceId);
  }

  // LlmCache
  async get(key: string) {
    return this.cache.get(key) ?? null;
  }

  async set(key: string, entry: { response: unknown }) {
    this.cache.set(key, entry.response);
  }

  // ReviewStore
  async listQueue(filter: QueueFilter) {
    return this.items.filter(
      (i) =>
        i.status === "pending" &&
        (!filter.type || i.type === filter.type) &&
        (!filter.tag || i.tags.includes(filter.tag)) &&
        (!filter.sourceId || i.sourceId === filter.sourceId),
    );
  }

  async queueTags() {
    return [...new Set(this.items.filter((i) => i.status === "pending").flatMap((i) => i.tags))].sort();
  }

  async getItem(id: string) {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async setStatus(ids: string[], status: "approved" | "discarded", action: ReviewAction) {
    const changed = this.items.filter((i) => ids.includes(i.id) && i.status === "pending");
    for (const item of changed) {
      item.status = status;
      this.events.push({ itemId: item.id, action });
    }
    return changed.map((i) => i.id);
  }

  /** Same contract as the Postgres store: writes only touch pending items. */
  private pending(ids: string[]): ItemView[] {
    const found = ids.map((id) => this.items.find((i) => i.id === id && i.status === "pending"));
    const stale = ids.filter((_, i) => !found[i]);
    if (stale.length > 0) throw new ItemNotPendingError(stale);
    return found as ItemView[];
  }

  async updateFields(id: string, fields: GeneratedFields) {
    Object.assign(this.pending([id])[0]!, fields, { edited: true });
    this.events.push({ itemId: id, action: "edit" });
  }

  async setTags(id: string, tags: string[]) {
    this.pending([id])[0]!.tags = tags;
    this.events.push({ itemId: id, action: "tag" });
  }

  async merge(ids: string[], build: (items: MergeCandidate[]) => GeneratedFields & { tags: string[] }) {
    const parts = this.pending(ids);
    const merged: ItemView = {
      ...parts[0]!,
      ...build(parts),
      id: this.id("item"),
      edited: true,
      status: "pending",
      excerpts: parts.flatMap((p) => p.excerpts),
    };
    this.items.push(merged);
    for (const p of parts) {
      p.status = "merged";
      this.events.push({ itemId: p.id, action: "merge" });
    }
    return merged.id;
  }
}
