"use client";

import { useActionState } from "react";
import { buttonClass, inputClass } from "@/components/ui";
import { uploadSourceAction, type UploadState } from "./actions";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadSourceAction, {});

  return (
    <form action={action} className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <div className="space-y-1">
        <label htmlFor="file" className="block text-sm font-medium">
          File
        </label>
        <input id="file" name="file" type="file" required accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown" className="block w-full text-sm" />
        <p className="text-xs text-muted">PDF, Markdown or text, up to 10 MB. Only upload material you are allowed to use.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium">
            Title <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="title" name="title" maxLength={200} className={inputClass} placeholder="Defaults to the file name" />
        </div>
        <div className="space-y-1">
          <label htmlFor="attribution" className="block text-sm font-medium">
            Attribution <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="attribution" name="attribution" maxLength={200} className={inputClass} placeholder="Author or publisher, if not you" />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {pending ? "Reading file…" : "Upload"}
      </button>
    </form>
  );
}
