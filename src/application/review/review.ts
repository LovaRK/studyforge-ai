import type { ItemView, ReviewStore } from "@/application/ports/study";
import { normalizeTags, type GeneratedFields } from "@/domain/items/item";

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

async function requirePending(store: ReviewStore, id: string): Promise<ItemView> {
  const item = await store.getItem(id);
  if (!item) throw new ReviewError("Item not found.");
  if (item.status !== "pending") throw new ReviewError("Only items in the review queue can be changed here.");
  return item;
}

/** Review decisions. Only approved items ever reach the library. */
export function makeReview(store: ReviewStore) {
  return {
    approve: (ids: string[]) => store.setStatus(ids, "approved", "approve"),
    discard: (ids: string[]) => store.setStatus(ids, "discarded", "discard"),

    async edit(id: string, fields: GeneratedFields): Promise<void> {
      await requirePending(store, id);
      await store.updateFields(id, fields);
    },

    async tag(id: string, tags: string[]): Promise<void> {
      await requirePending(store, id);
      await store.setTags(id, normalizeTags(tags));
    },

    /**
     * Combines two or more pending items into one that keeps all their excerpts.
     * The first item's wording leads; summaries and answers are joined.
     */
    async merge(ids: string[]): Promise<string> {
      const unique = [...new Set(ids)];
      if (unique.length < 2) throw new ReviewError("Select at least two items to merge.");
      const items = await Promise.all(unique.map((id) => requirePending(store, id)));
      const [first] = items as [ItemView, ...ItemView[]];
      const join = (values: string[]) => [...new Set(values.map((v) => v.trim()).filter(Boolean))].join("\n\n");

      return store.merge(unique, {
        type: first.type,
        title: first.title,
        summary: join(items.map((item) => item.summary)),
        question: first.question,
        answer: join(items.map((item) => item.answer)),
        tags: normalizeTags(items.flatMap((item) => item.tags)),
      });
    },
  };
}

export type Review = ReturnType<typeof makeReview>;
