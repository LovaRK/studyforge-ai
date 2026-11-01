import type { LibraryFilter, LibraryItem, LibraryStore } from "@/application/ports/library";
import { ITEM_TYPES, type ItemType } from "@/domain/items/item";
import { toPrefixTsQuery } from "@/domain/text/search-query";

export interface LibraryGroup {
  type: ItemType;
  items: LibraryItem[];
}

export interface LibraryPage {
  /** True when the search box held something searchable. */
  searched: boolean;
  total: number;
  /** Non-empty groups in the fixed type order; items keep the store's order (best match first when searching). */
  groups: LibraryGroup[];
}

/** The library of approved items: browse by type, filter by tag or source, full-text search. */
export function makeLibrary(store: LibraryStore) {
  return {
    async browse(filter: LibraryFilter & { query?: string }): Promise<LibraryPage> {
      const tsquery = filter.query ? toPrefixTsQuery(filter.query) : null;
      const items = await store.list({ type: filter.type, tag: filter.tag, sourceId: filter.sourceId, tsquery: tsquery ?? undefined });
      const groups = ITEM_TYPES.map((type) => ({ type, items: items.filter((item) => item.type === type) })).filter(
        (group) => group.items.length > 0,
      );
      return { searched: tsquery !== null, total: items.length, groups };
    },

    facets: () => store.facets(),
  };
}

export type Library = ReturnType<typeof makeLibrary>;
