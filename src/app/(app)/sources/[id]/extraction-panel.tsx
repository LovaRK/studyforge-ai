"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import type { ExtractionProgress } from "@/application/ports/study";
import { buttonClass, Spinner } from "@/components/ui";
import { startExtractionAction } from "../actions";

export function ExtractionPanel({ sourceId, progress, running }: { sourceId: string; progress: ExtractionProgress; running: boolean }) {
  const router = useRouter();
  const { totalChunks, doneChunks, failedChunks } = progress;
  const complete = totalChunks > 0 && doneChunks === totalChunks;
  const percent = totalChunks === 0 ? 0 : Math.round((doneChunks / totalChunks) * 100);

  // Poll for progress while a run is active.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(timer);
  }, [running, router]);

  const label = running ? "Extracting…" : doneChunks === 0 && failedChunks === 0 ? "Start extraction" : "Resume extraction";

  return (
    <section className="space-y-3 rounded-lg border border-line bg-surface p-4" aria-labelledby="extraction-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="extraction-heading" className="font-medium">
          Extraction
        </h2>
        {/* A form, not an onClick: it works before hydration and without JavaScript. */}
        {!complete && (
          <form action={startExtractionAction.bind(null, sourceId)}>
            <StartButton label={label} disabled={running} />
          </form>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-label="Extraction progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-accent to-accent-2 transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm text-muted" data-testid="extraction-status">
        {complete ? "Extraction complete" : running ? "Running" : "Idle"} · {doneChunks} of {totalChunks} chunks done
        {failedChunks > 0 && ` · ${failedChunks} failed (resume to retry)`} · {progress.pendingItems} waiting for review ·{" "}
        {progress.rejectedItems} rejected
      </p>
    </section>
  );
}

function StartButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={buttonClass.primary} disabled={disabled || pending}>
      {pending && <Spinner />}
      {label}
    </button>
  );
}
