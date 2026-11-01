"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ChangeEvent } from "react";
import { inputClass } from "@/components/ui";

interface Props {
  tags: string[];
  sources: { id: string; title: string }[];
  /** The current choice as "tag:<name>", "source:<id>" or "". */
  value: string;
}

/** One select for "what to study": everything, a tag, or a source. Applies on change. */
export function ScopePicker({ tags, sources, value }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const [kind, ...rest] = event.target.value.split(":");
    const params = new URLSearchParams();
    if (kind === "tag" || kind === "source") params.set(kind, rest.join(":"));
    router.push(`${pathname}${params.size ? `?${params}` : ""}`);
  }

  return (
    <select aria-label="Study" className={`${inputClass} sm:w-auto`} value={value} onChange={onChange}>
      <option value="">Everything</option>
      {tags.length > 0 && (
        <optgroup label="Tag">
          {tags.map((tag) => (
            <option key={tag} value={`tag:${tag}`}>
              {tag}
            </option>
          ))}
        </optgroup>
      )}
      {sources.length > 0 && (
        <optgroup label="Source">
          {sources.map((source) => (
            <option key={source.id} value={`source:${source.id}`}>
              {source.title}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
