import type { ReactNode } from "react";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg bg-linear-to-br from-accent to-accent-2 px-3.5 py-1.5 text-sm font-medium text-accent-contrast shadow-md shadow-accent/25 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-accent/30 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition duration-150 hover:bg-subtle active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-danger transition duration-150 hover:border-danger/40 hover:bg-danger/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
};

export const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15";

/** Small spinner for buttons and panels while work is in flight. */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** The StudyForge mark: an open book with a spark, drawn in the accent gradient. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-lg bg-linear-to-br from-accent to-accent-2 text-accent-contrast shadow-md shadow-accent/30 ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[62%]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 7v13M3 18.5V6a1 1 0 0 1 1-1c3 0 5.5.6 8 2 2.5-1.4 5-2 8-2a1 1 0 0 1 1 1v12.5c-3 0-5.5.6-8 2-2.5-1.4-5-2-8-2Z" />
      </svg>
    </span>
  );
}

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
    <span
      className="text-[11px] font-semibold uppercase tracking-wide text-muted"
      title="Written by the model. Check it against the source fact."
    >
      Generated interpretation
    </span>
  );
}

/** Marks text as a verbatim quote from the owner's source. */
export function SourceFactLabel() {
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-wide text-accent"
      title="Copied word for word from the source and verified."
    >
      Source fact
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-accent/10 text-accent" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 3 1.9 5.8L20 10l-5 3.6L16.8 20 12 16.4 7.2 20 9 13.6 4 10l6.1-1.2Z" />
        </svg>
      </span>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
