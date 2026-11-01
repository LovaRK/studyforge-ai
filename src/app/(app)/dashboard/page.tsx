import type { Metadata } from "next";
import Link from "next/link";
import type { MasteryGroup } from "@/application/dashboard/dashboard";
import { buttonClass } from "@/components/ui";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";
import { DemoButton } from "./demo-button";
export const metadata: Metadata = { title: "Understanding · StudyForge AI" };
function Mastery({ title, groups, kind }: { title: string; groups: MasteryGroup[]; kind: "tag" | "source" }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted">Established cards / approved items</p>
      {groups.length ? (
        <ul className="mt-5 space-y-5">
          {groups.map((g) => (
            <li key={g.key}>
              <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                <Link className="min-w-0 break-words hover:underline" href={`/flashcards?${kind}=${encodeURIComponent(g.key)}`}>
                  {g.label}
                </Link>
                <span className="shrink-0 tabular-nums text-muted">
                  {g.established} / {g.total} · {g.percent}%
                </span>
              </div>
              <progress
                aria-label={`${g.label} established`}
                value={g.established}
                max={g.total}
                className="block h-2 w-full overflow-hidden rounded-full accent-accent"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-muted">
          Approve {kind === "tag" ? "tagged items" : "items from a source"} to see your progress here.
        </p>
      )}
    </section>
  );
}
export default async function DashboardPage() {
  await requireOwner();
  const d = await container().dashboard.read();
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Your understanding</p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Small sessions.
          <br />
          Knowledge that stays.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Your own notes, checked against their sources. Build recall one approved idea at a time.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/flashcards" className={buttonClass.primary}>
            Study {d.due} due cards
          </Link>
          <Link href="/quiz" className={buttonClass.secondary}>
            Take a quick quiz
          </Link>
          <Link href="/review" className={buttonClass.secondary}>
            Review {d.pending} pending
          </Link>
          <DemoButton />
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Approved ideas", d.approved, `${d.established} established`],
          ["Due now", d.due, `${d.newCards} new cards included`],
          ["Study streak", `${d.streak} days`, "Calendar days · UTC"],
          ["Quiz accuracy", d.accuracy === null ? "—" : `${d.accuracy}%`, `${d.quizAnswers} recorded answers`],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums">{value}</dd>
            <dd className="mt-2 text-xs text-muted">{note}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <Mastery title="Mastery by tag" groups={d.byTag} kind="tag" />
        <Mastery title="Mastery by source" groups={d.bySource} kind="source" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Last seven days" className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">A little every day</h2>
          <p className="mt-1 text-xs text-muted">Card reviews + quiz answers · last 7 UTC days</p>
          <ol className="mt-5 grid grid-cols-7 gap-2">
            {d.days.map((day) => (
              <li key={day.date} className="min-w-0 text-center">
                <div className="rounded-lg bg-subtle py-5 text-lg font-semibold tabular-nums">{day.count}</div>
                <time dateTime={day.date} className="mt-2 block text-xs text-muted">
                  {day.date.slice(5)}
                </time>
              </li>
            ))}
          </ol>
        </section>
        <section aria-label="Review decisions" className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">You decide what stays</h2>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            {[
              ["Approved", d.approved],
              ["Edited", d.edited],
              ["Merged originals", d.merged],
              ["Discarded", d.discarded],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            Word-for-word check: <strong className="text-foreground">{d.rejected} rejected</strong> ·{" "}
            {d.rejectionRate === null ? "No extractions yet" : `${d.rejectionRate}% of extracted candidates`} · {d.verified} verified
          </p>
        </section>
      </div>
      <details className="rounded-xl border border-line p-4 text-sm text-muted">
        <summary className="cursor-pointer font-medium text-foreground">How these numbers work</summary>
        <p className="mt-3">
          Mastery is a study signal, not a knowledge assessment: an established card has at least two consecutive successful SM-2 reviews.
          Tags can overlap. Source groups use the item’s primary source. Due includes new cards. Quiz accuracy uses recorded quiz answers
          only; self-rated cards are not quiz scores.
        </p>
        <p className="mt-2">
          A streak counts consecutive UTC dates with a card or quiz answer, ending today or yesterday. Review counts describe current item
          states; edited includes any item edited before approval. Rejection rate uses extraction candidates, so merging items cannot change
          it.
        </p>
      </details>
    </div>
  );
}
