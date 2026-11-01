import { describe, expect, it } from "vitest";
import type { LibraryFilter, LibraryItem, LibraryStore } from "@/application/ports/library";
import type { ItemType } from "@/domain/items/item";
import { makeLibrary } from "./library";

function item(id: string, type: ItemType): LibraryItem {
  return {
    id,
    type,
    title: id,
    summary: "",
    tags: [],
    sourceId: "s",
    sourceTitle: "S",
    excerptCount: 1,
    snippet: [{ text: "quote", match: false }],
  };
}

function storeReturning(items: LibraryItem[]) {
  const calls: (LibraryFilter & { tsquery?: string })[] = [];
  const store: LibraryStore = {
    async list(filter) {
      calls.push(filter);
      return items;
    },
    async facets() {
      return { total: items.length, tags: [], sources: [] };
    },
  };
  return { store, calls };
}

describe("library", () => {
  it("groups items by type in the fixed type order and keeps the store's order inside a group", async () => {
    const { store } = storeReturning([item("t2", "term"), item("h1", "how_to"), item("c1", "concept"), item("t1", "term")]);
    const page = await makeLibrary(store).browse({});

    expect(page.groups.map((g) => [g.type, g.items.map((i) => i.id)])).toEqual([
      ["concept", ["c1"]],
      ["term", ["t2", "t1"]],
      ["how_to", ["h1"]],
    ]);
    expect(page).toMatchObject({ total: 4, searched: false });
  });

  it("turns the search box into a safe prefix query and passes the filters through", async () => {
    const { store, calls } = storeReturning([]);
    const page = await makeLibrary(store).browse({ query: "Grand central!", type: "term", tag: "gcd", sourceId: "src" });

    expect(calls).toEqual([{ type: "term", tag: "gcd", sourceId: "src", tsquery: "grand:* & central:*" }]);
    expect(page).toEqual({ searched: true, total: 0, groups: [] });
  });

  it("browses without a text query when the search box holds nothing searchable", async () => {
    const { store, calls } = storeReturning([item("c1", "concept")]);
    const page = await makeLibrary(store).browse({ query: " -- " });

    expect(calls[0]!.tsquery).toBeUndefined();
    expect(page.searched).toBe(false);
  });
});
