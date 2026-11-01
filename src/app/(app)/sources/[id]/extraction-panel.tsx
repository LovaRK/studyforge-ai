"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import type { ExtractionProgress } from "@/application/ports/study";
import { buttonClass } from "@/components/ui";
import { startExtractionAction } from "../actions";

export function ExtractionPanel({ sourceId, progress, running }: { sourceId: string; progress: ExtractionProgress; running: boolean }) {
  const router = useRouter();
  const [starting, startTransition] = useTransition();
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
        {!complete && (
          <button
            type="button"
            className={buttonClass.primary}
            disabled={running || starting}
            onClick={() =>
              startTransition(async () => {
                await startExtractionAction(sourceId);
                router.refresh();
              })
            }
          >
            {label}
          </button>
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
        <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-muted" data-testid="extraction-status">
        {complete ? "Extraction complete" : running ? "Running" : "Idle"} · {doneChunks} of {totalChunks} chunks done
        {failedChunks > 0 && ` · ${failedChunks} failed (resume to retry)`} · {progress.pendingItems} waiting for review ·{" "}
        {progress.rejectedItems} rejected
      </p>
    </section>
  );
}
