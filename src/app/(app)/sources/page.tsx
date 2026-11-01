import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Sources · StudyForge AI" };

export default async function SourcesPage() {
  await requireOwner();
  const sources = await container().sources.list();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="text-muted">Everything you study comes from these documents, and every item links back to them.</p>
      </div>
      <UploadForm />
      {sources.length === 0 ? (
        <EmptyState title="No sources yet">Upload your first notes above.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {sources.map((s) => (
            <li key={s.id}>
              <Link href={`/sources/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-subtle">
                <span>
                  <span className="font-medium">{s.title}</span>
                  {s.attribution && <span className="block text-xs text-muted">Source: {s.attribution}</span>}
                </span>
                <span className="text-sm text-muted tabular-nums">
                  {s.wordCount.toLocaleString()} words · {s.doneChunks}/{s.totalChunks} chunks · {s.pendingItems} to review · {s.approvedItems} approved ·{" "}
                  {s.rejectedItems} rejected
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
