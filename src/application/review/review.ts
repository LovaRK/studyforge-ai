import { ItemNotPendingError, type MergeCandidate, type ReviewStore } from "@/application/ports/study";
import { normalizeTags, type GeneratedFields } from "@/domain/items/item";

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

const NOT_PENDING = "This item is no longer in the review queue. It may have just been approved, discarded or merged.";

/** Turns the store's concurrency error into a message for the owner. */
async function guarded<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof ItemNotPendingError) throw new ReviewError(NOT_PENDING);
    throw error;
  }
}

/** The first item's wording leads; summaries and answers are joined; tags are combined. */
export function mergeWording(items: MergeCandidate[]): GeneratedFields & { tags: string[] } {
  const [first] = items as [MergeCandidate, ...MergeCandidate[]];
  const join = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))].join("\n\n");
  return {
    type: first.type,
    title: first.title,
    summary: join(items.map((item) => item.summary)),
    question: first.question,
    answer: join(items.map((item) => item.answer)),
    tags: normalizeTags(items.flatMap((item) => item.tags)),
  };
}

/** Review decisions. Only approved items ever reach the library. */
export function makeReview(store: ReviewStore) {
  return {
    approve: (ids: string[]) => store.setStatus(ids, "approved", "approve"),
    discard: (ids: string[]) => store.setStatus(ids, "discarded", "discard"),

    edit: (id: string, fields: GeneratedFields) => guarded(() => store.updateFields(id, fields)),

    tag: (id: string, tags: string[]) => guarded(() => store.setTags(id, normalizeTags(tags))),

    /** Combines two or more pending items into one that keeps all their excerpts. */
    async merge(ids: string[]): Promise<string> {
      const unique = [...new Set(ids)];
      if (unique.length < 2) throw new ReviewError("Select at least two items to merge.");
      return guarded(() => store.merge(unique, mergeWording));
    },
  };
}

export type Review = ReturnType<typeof makeReview>;
