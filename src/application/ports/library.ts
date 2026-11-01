import type { ItemType } from "@/domain/items/item";

export interface LibraryFilter {
  type?: ItemType;
  tag?: string;
  sourceId?: string;
}

/** A run of source text; `match` marks words that matched the search. */
export interface TextSegment {
  text: string;
  match: boolean;
}

/** An approved item as the library lists it. */
export interface LibraryItem {
  id: string;
  type: ItemType;
  title: string;
  /** Generated interpretation. */
  summary: string;
  tags: string[];
  sourceId: string;
  sourceTitle: string;
  excerptCount: number;
  /**
   * Verbatim source text: the first excerpt, or for a search every excerpt
   * (joined by " … ") with the matched words marked. Never shortened.
   */
  snippet: TextSegment[];
}

export interface LibraryFacets {
  /** Approved items in the library, before any filter. */
  total: number;
  tags: string[];
  sources: { id: string; title: string }[];
}

export interface LibraryStore {
  /**
   * Approved items only. With `tsquery` (a `to_tsquery` expression), only items
   * whose search document matches, best match first; otherwise ordered by title.
   */
  list(filter: LibraryFilter & { tsquery?: string }): Promise<LibraryItem[]>;
  facets(): Promise<LibraryFacets>;
}
