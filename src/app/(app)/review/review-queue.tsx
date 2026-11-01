"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ItemView } from "@/application/ports/study";
import { Badge, buttonClass, EmptyState, GeneratedLabel, inputClass, SourceFactLabel } from "@/components/ui";
import { ITEM_TYPE_LABELS, ITEM_TYPES, type GeneratedFields, type ItemType } from "@/domain/items/item";
import { approveAction, discardAction, editAction, mergeAction, tagAction, type ActionResult } from "./actions";

export interface SourceContext {
  sourceTitle: string;
  sourceAttribution: string | null;
  before: string;
  match: string;
  after: string;
  truncatedBefore: boolean;
  truncatedAfter: boolean;
}

interface Props {
  queue: ItemView[];
  selected: ItemView | null;
  context: SourceContext[];
  tags: string[];
  sources: { id: string; title: string }[];
  filters: { type?: ItemType; tag?: string; source?: string };
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function ReviewQueue({ queue, selected, context, tags, sources, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Edit mode belongs to one item, so it ends by itself when the selection changes.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = selected !== null && editingId === selected.id;
  const setEditing = useCallback((on: boolean) => setEditingId(on && selected ? selected.id : null), [selected]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tagInputRef = useRef<HTMLInputElement>(null);

  const index = selected ? queue.findIndex((item) => item.id === selected.id) : -1;

  const navigate = useCallback(
    (changes: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(`/review${params.size ? `?${params}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  const select = useCallback((id: string | undefined) => navigate({ item: id }), [navigate]);

  const perform = useCallback(
    (action: () => Promise<ActionResult>, after?: (result: Extract<ActionResult, { ok: true }>) => void) => {
      setError(null);
      startTransition(async () => {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        after?.(result);
        router.refresh();
      });
    },
    [router],
  );

  /** Approve or discard, then move to the neighbouring item. */
  const decide = useCallback(
    (kind: "approve" | "discard", ids: string[]) => {
      const remaining = queue.filter((item) => !ids.includes(item.id));
      const next = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
      perform(
        () => (kind === "approve" ? approveAction(ids) : discardAction(ids)),
        () => {
          setChecked(new Set());
          select(next?.id);
        },
      );
    },
    [index, perform, queue, select],
  );

  const toggleChecked = useCallback((id: string) => {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const merge = useCallback(() => {
    const ids = queue.filter((item) => checked.has(item.id)).map((item) => item.id);
    perform(
      () => mergeAction(ids),
      (result) => {
        setChecked(new Set());
        select(result.id);
      },
    );
  }, [checked, perform, queue, select]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (editing || pending || isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if ((key === "j" || event.key === "ArrowDown") && index < queue.length - 1) select(queue[index + 1]!.id);
      else if ((key === "k" || event.key === "ArrowUp") && index > 0) select(queue[index - 1]!.id);
      else if (key === "a" && selected) decide("approve", checked.size > 0 ? [...checked] : [selected.id]);
      else if (key === "d" && selected) decide("discard", checked.size > 0 ? [...checked] : [selected.id]);
      else if (key === "e" && selected) setEditing(true);
      else if (key === "x" && selected) toggleChecked(selected.id);
      else if (key === "t" && selected) tagInputRef.current?.focus();
      else if (key === "m" && checked.size >= 2) merge();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checked, decide, editing, index, merge, pending, queue, select, selected, setEditing, toggleChecked]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
          <p className="text-sm text-muted">
            {queue.length} item{queue.length === 1 ? "" : "s"} waiting. Only what you approve reaches your library.
          </p>
        </div>
        <Filters filters={filters} tags={tags} sources={sources} onChange={(changes) => navigate({ ...changes, item: undefined })} />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {checked.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-sm"
          aria-label="Bulk actions"
        >
          <span className="font-medium">{checked.size} selected</span>
          <button type="button" className={buttonClass.primary} disabled={pending} onClick={() => decide("approve", [...checked])}>
            Approve selected
          </button>
          <button type="button" className={buttonClass.danger} disabled={pending} onClick={() => decide("discard", [...checked])}>
            Discard selected
          </button>
          <button type="button" className={buttonClass.secondary} disabled={pending || checked.size < 2} onClick={merge}>
            Merge selected
          </button>
          <button type="button" className="text-muted underline" onClick={() => setChecked(new Set())}>
            Clear
          </button>
        </div>
      )}

      {queue.length === 0 || !selected ? (
        <EmptyState title="Nothing to review">
          {filters.type || filters.tag || filters.source
            ? "No items match these filters."
            : "Upload a source and run extraction to fill the queue."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1fr)]">
          <ol className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-surface lg:sticky lg:top-4" aria-label="Queue">
            {queue.map((item) => (
              <li key={item.id} className="flex items-start gap-2 border-b border-line px-2 py-2 last:border-b-0">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked.has(item.id)}
                  onChange={() => toggleChecked(item.id)}
                  aria-label={`Select ${item.title}`}
                />
                <button
                  type="button"
                  onClick={() => select(item.id)}
                  aria-current={item.id === selected.id ? "true" : undefined}
                  className={`min-w-0 flex-1 rounded px-1 text-left text-sm ${item.id === selected.id ? "bg-accent/10 font-medium" : "hover:bg-subtle"}`}
                >
                  <span className="block truncate">{item.title}</span>
                  <span className="text-xs text-muted">{ITEM_TYPE_LABELS[item.type]}</span>
                </button>
              </li>
            ))}
          </ol>

          <ItemPanel
            key={selected.id}
            item={selected}
            editing={editing}
            pending={pending}
            tagInputRef={tagInputRef}
            onEdit={() => setEditing(true)}
            onCancelEdit={() => setEditing(false)}
            onSave={(fields) =>
              perform(
                () => editAction(selected.id, fields),
                () => setEditing(false),
              )
            }
            onTags={(next) => perform(() => tagAction(selected.id, next))}
            onApprove={() => decide("approve", [selected.id])}
            onDiscard={() => decide("discard", [selected.id])}
          />

          <SourcePanel item={selected} context={context} />
        </div>
      )}

      <p className="text-xs text-muted">
        Shortcuts: <kbd>j</kbd>/<kbd>k</kbd> next/previous · <kbd>a</kbd> approve · <kbd>d</kbd> discard · <kbd>e</kbd> edit · <kbd>t</kbd>{" "}
        tag · <kbd>x</kbd> select · <kbd>m</kbd> merge selected
      </p>
    </div>
  );
}

function Filters({
  filters,
  tags,
  sources,
  onChange,
}: {
  filters: Props["filters"];
  tags: string[];
  sources: Props["sources"];
  onChange: (changes: Record<string, string | undefined>) => void;
}) {
  const selectClass = `${inputClass} w-auto`;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Filters">
      <select
        aria-label="Filter by type"
        className={selectClass}
        value={filters.type ?? ""}
        onChange={(e) => onChange({ type: e.target.value || undefined })}
      >
        <option value="">All types</option>
        {ITEM_TYPES.map((type) => (
          <option key={type} value={type}>
            {ITEM_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by tag"
        className={selectClass}
        value={filters.tag ?? ""}
        onChange={(e) => onChange({ tag: e.target.value || undefined })}
      >
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by source"
        className={selectClass}
        value={filters.source ?? ""}
        onChange={(e) => onChange({ source: e.target.value || undefined })}
      >
        <option value="">All sources</option>
        {sources.map((source) => (
          <option key={source.id} value={source.id}>
            {source.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function ItemPanel({
  item,
  editing,
  pending,
  tagInputRef,
  onEdit,
  onCancelEdit,
  onSave,
  onTags,
  onApprove,
  onDiscard,
}: {
  item: ItemView;
  editing: boolean;
  pending: boolean;
  tagInputRef: React.RefObject<HTMLInputElement | null>;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (fields: GeneratedFields) => void;
  onTags: (tags: string[]) => void;
  onApprove: () => void;
  onDiscard: () => void;
}) {
  const [draft, setDraft] = useState<GeneratedFields>({
    type: item.type,
    title: item.title,
    summary: item.summary,
    question: item.question,
    answer: item.answer,
  });
  const [newTag, setNewTag] = useState("");

  return (
    <article className="space-y-4 rounded-lg border border-line bg-surface p-4" aria-label="Item">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{ITEM_TYPE_LABELS[item.type]}</Badge>
        {item.edited && <Badge>Edited</Badge>}
        {item.excerpts.length > 1 && <Badge>Merged · {item.excerpts.length} excerpts</Badge>}
      </div>

      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <GeneratedLabel />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Type</span>
            <select className={inputClass} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ItemType })}>
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ITEM_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          {(["title", "summary", "question", "answer"] as const).map((field) => (
            <label key={field} className="block space-y-1 text-sm">
              <span className="font-medium capitalize">{field}</span>
              {field === "title" ? (
                <input
                  className={inputClass}
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                  autoFocus
                />
              ) : (
                <textarea
                  className={inputClass}
                  rows={field === "question" ? 2 : 4}
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                />
              )}
            </label>
          ))}
          <div className="flex gap-2">
            <button type="submit" className={buttonClass.primary} disabled={pending}>
              Save
            </button>
            <button type="button" className={buttonClass.secondary} onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <GeneratedLabel />
          <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{item.summary}</p>
          <dl className="space-y-2 rounded-md bg-subtle p-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-muted">Flashcard question</dt>
              <dd>{item.question}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Answer</dt>
              <dd className="whitespace-pre-wrap">{item.answer}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-3">
        <SourceFactLabel />
        {item.excerpts.map((excerpt, i) => (
          <figure key={i} className="space-y-1">
            <blockquote className="border-l-2 border-accent pl-3 text-sm leading-relaxed">{excerpt.text}</blockquote>
            <figcaption className="pl-3 text-xs text-muted" data-testid="excerpt-source">
              {excerpt.sourceTitle}
              {excerpt.sourceAttribution && ` · Source: ${excerpt.sourceAttribution}`}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <span className="text-sm font-medium">Tags</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded border border-line bg-subtle px-1.5 py-0.5 text-xs">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                className="text-muted hover:text-danger"
                onClick={() => onTags(item.tags.filter((t) => t !== tag))}
              >
                ×
              </button>
            </span>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (newTag.trim()) onTags([...item.tags, newTag]);
              setNewTag("");
            }}
          >
            <input
              ref={tagInputRef}
              aria-label="Add tag"
              placeholder="Add tag"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
              className={`${inputClass} h-7 w-28 py-0 text-xs`}
            />
          </form>
        </div>
      </div>

      {!editing && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <button type="button" className={buttonClass.primary} disabled={pending} onClick={onApprove}>
            Approve
          </button>
          <button type="button" className={buttonClass.secondary} disabled={pending} onClick={onEdit}>
            Edit
          </button>
          <button type="button" className={buttonClass.danger} disabled={pending} onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}
    </article>
  );
}

function SourcePanel({ item, context }: { item: ItemView; context: SourceContext[] }) {
  const paneRef = useRef<HTMLDivElement>(null);

  // Bring the first highlighted excerpt into view inside the pane.
  useEffect(() => {
    const pane = paneRef.current;
    const mark = pane?.querySelector("mark");
    if (pane && mark instanceof HTMLElement) pane.scrollTop = Math.max(0, mark.offsetTop - pane.clientHeight / 3);
  }, [item.id]);

  return (
    <section className="rounded-lg border border-line bg-surface" aria-label="Source text">
      <div ref={paneRef} className="relative max-h-[70vh] divide-y divide-line overflow-auto">
        {context.map((part, i) => (
          <div key={i}>
            {/* Each excerpt is shown inside its own document; merged items can quote several. */}
            <div className="sticky top-0 border-b border-line bg-surface px-4 py-2" data-testid="context-source">
              <p className="text-sm font-medium">{part.sourceTitle}</p>
              {part.sourceAttribution && <p className="text-xs text-muted">Source: {part.sourceAttribution}</p>}
            </div>
            <p className="whitespace-pre-wrap break-words px-4 py-3 text-sm leading-relaxed text-muted">
              {part.truncatedBefore && "… "}
              {part.before}
              <mark className="rounded-sm bg-accent/20 px-0.5 text-foreground" data-testid="source-highlight">
                {part.match}
              </mark>
              {part.after}
              {part.truncatedAfter && " …"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
