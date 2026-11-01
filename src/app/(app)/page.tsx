import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export default async function HomePage() {
  await requireOwner();
  const sources = await container().sources.list();
  const pending = sources.reduce((sum, s) => sum + s.pendingItems, 0);
  const approved = sources.reduce((sum, s) => sum + s.approvedItems, 0);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="max-w-prose text-muted">
          Upload your notes, check each extracted item against the sentence it came from, and keep only what you approve.
        </p>
      </div>
      <dl className="grid max-w-xl grid-cols-3 gap-3">
        {[
          ["Sources", sources.length],
          ["Waiting for review", pending],
          ["Approved", approved],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-2">
        <Link href="/sources" className={buttonClass.primary}>
          Add a source
        </Link>
        {pending > 0 && (
          <Link href="/review" className={buttonClass.secondary}>
            Review {pending} item{pending === 1 ? "" : "s"}
          </Link>
        )}
      </div>
    </section>
  );
}
