import type { ReactNode } from "react";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50",
};

export const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "danger" }) {
  const tones = {
    neutral: "border-line bg-subtle text-muted",
    accent: "border-accent/40 bg-accent/10 text-accent",
    danger: "border-danger/40 bg-danger/10 text-danger",
  };
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/** Marks text as the model's wording, never as fact. */
export function GeneratedLabel() {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted" title="Written by the model. Check it against the source fact.">
      Generated interpretation
    </span>
  );
}

/** Marks text as a verbatim quote from the owner's source. */
export function SourceFactLabel() {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-accent" title="Copied word for word from the source and verified.">
      Source fact
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
