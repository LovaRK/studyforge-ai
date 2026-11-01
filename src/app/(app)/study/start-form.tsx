"use client";

import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { startSessionAction, type StartState } from "./actions";

const LENGTHS = [5, 10, 15, 25];

interface Props {
  tags: string[];
  sources: { id: string; title: string }[];
}

export function StartSessionForm({ tags, sources }: Props) {
  const [state, action, pending] = useActionState<StartState, FormData>(startSessionAction, {});
  return (
    <form action={action} className="space-y-5 rounded-lg border border-line bg-surface p-5">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">What to study</span>
        <select name="scope" className={inputClass} defaultValue="">
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
      </label>
      <fieldset className="space-y-1 text-sm">
        <legend className="font-medium">For how long</legend>
        <div className="flex flex-wrap gap-2 pt-1">
          {LENGTHS.map((minutes) => (
            <label key={minutes} className="cursor-pointer">
              <input type="radio" name="minutes" value={minutes} defaultChecked={minutes === 15} className="peer sr-only" />
              <span
                className={`${buttonClass.secondary} peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30`}
              >
                {minutes} min
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" className={buttonClass.primary} disabled={pending}>
        Start session
      </button>
    </form>
  );
}
