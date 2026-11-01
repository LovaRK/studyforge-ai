"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { ITEM_TYPE_LABELS, ITEM_TYPES, type ItemType } from "@/domain/items/item";
import { MAX_SEARCH_LENGTH } from "@/domain/text/search-query";

export interface LibraryFilterValues {
  q?: string;
  type?: ItemType;
  tag?: string;
  source?: string;
}

interface Props {
  filters: LibraryFilterValues;
  tags: string[];
  sources: { id: string; title: string }[];
}

/**
 * A plain GET form, so search works without JavaScript. With JavaScript it
 * navigates client-side, drops empty fields from the URL, and applies a
 * select as soon as it changes.
 */
export function LibraryFilters({ filters, tags, sources }: Props) {
  const router = useRouter();
  const selectClass = `${inputClass} sm:w-auto`;
  const active = Object.values(filters).some(Boolean);

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim()) params.set(key, value.trim());
    }
    router.push(`/library${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    apply(event.currentTarget);
  };
  const onSelect = (event: ChangeEvent<HTMLSelectElement>) => event.currentTarget.form && apply(event.currentTarget.form);

  return (
    <form action="/library" role="search" onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <input
        type="search"
        name="q"
        defaultValue={filters.q}
        maxLength={MAX_SEARCH_LENGTH}
        aria-label="Search the library"
        placeholder="Search titles, tags, wording and excerpts"
        className={`${inputClass} sm:min-w-56 sm:flex-1`}
      />
      <select name="type" aria-label="Filter by type" defaultValue={filters.type ?? ""} onChange={onSelect} className={selectClass}>
        <option value="">All types</option>
        {ITEM_TYPES.map((type) => (
          <option key={type} value={type}>
            {ITEM_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <select name="tag" aria-label="Filter by tag" defaultValue={filters.tag ?? ""} onChange={onSelect} className={selectClass}>
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <select name="source" aria-label="Filter by source" defaultValue={filters.source ?? ""} onChange={onSelect} className={selectClass}>
        <option value="">All sources</option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.title}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass.primary}>
          Search
        </button>
        {active && (
          <Link href="/library" className={buttonClass.secondary}>
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
