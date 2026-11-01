import type { LibraryItem, LibraryStore } from "@/application/ports/library";
import type { ExcerptView, ItemView, ReviewStore, SourceStore } from "@/application/ports/study";
import { splitSteps } from "@/domain/items/steps";
import { excerptContext, type TextContext } from "@/domain/text/context";

/** Characters of source text shown on each side of an excerpt. */
export const CONTEXT_CHARS = 280;
export const RELATED_LIMIT = 6;

export interface ExcerptInContext extends ExcerptView {
  context: TextContext;
}

export interface ConceptPage {
  item: ItemView;
  /** For how-tos and processes whose generated answer is a list: its steps. */
  steps: string[] | null;
  /** Every source fact behind the item, each read from its own document. */
  excerpts: ExcerptInContext[];
  related: LibraryItem[];
}

interface Deps {
  items: Pick<ReviewStore, "getItem">;
  sources: Pick<SourceStore, "findById">;
  library: Pick<LibraryStore, "related">;
}

/** The page for one approved item: concept page, or how-to guide for procedures. */
export function makeConceptPages({ items, sources, library }: Deps) {
  return {
    async get(id: string): Promise<ConceptPage | null> {
      const item = await items.getItem(id);
      // Only approved items have pages; pending, discarded and merged ones stay in review.
      if (!item || item.status !== "approved") return null;

      const sourceIds = [...new Set(item.excerpts.map((excerpt) => excerpt.sourceId))];
      const [documents, related] = await Promise.all([
        Promise.all(sourceIds.map((sourceId) => sources.findById(sourceId))),
        library.related(item, RELATED_LIMIT),
      ]);
      const text = new Map(documents.flatMap((source) => (source ? [[source.id, source.text] as const] : [])));

      return {
        item,
        steps: item.type === "how_to" || item.type === "process" ? splitSteps(item.answer) : null,
        excerpts: item.excerpts.flatMap((excerpt) => {
          const source = text.get(excerpt.sourceId);
          return source === undefined ? [] : [{ ...excerpt, context: excerptContext(source, excerpt.start, excerpt.end, CONTEXT_CHARS) }];
        }),
        related,
      };
    },
  };
}

export type ConceptPages = ReturnType<typeof makeConceptPages>;
