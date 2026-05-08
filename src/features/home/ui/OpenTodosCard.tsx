import { CheckCircle, ListChecks } from "@phosphor-icons/react";

import type { Todo } from "@/shared/ipc/IpcContract";

const PREVIEW_LIMIT = 6;
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

type OpenTodosCardProps = {
  todos: Todo[];
  doneThisWeek: number;
  onToggle: (id: string) => void;
  onOpenAll: () => void;
};

export function OpenTodosCard({ todos, doneThisWeek, onToggle, onOpenAll }: OpenTodosCardProps) {
  const open = todos.filter((todo) => !todo.done);
  const total = open.length;
  const preview = open.slice(0, PREVIEW_LIMIT);
  const overflow = Math.max(0, total - PREVIEW_LIMIT);
  const staleCount = open.filter((todo) => isStale(todo)).length;

  return (
    <section
      aria-labelledby="home-todos-heading"
      className="space-y-3"
      data-testid="home-open-todos"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">
            Todos
          </p>
          <h2 id="home-todos-heading" className="text-lg font-semibold">
            {total === 0 ? "All clear" : `${total} open`}
          </h2>
        </div>
        <p className="text-xs text-[var(--color-noxe-muted)]">
          {doneThisWeek > 0 ? `${doneThisWeek} done this week` : "No completions yet this week"}
        </p>
      </div>

      {total === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--color-noxe-border)] p-5 text-sm text-[var(--color-noxe-muted)]">
          <CheckCircle weight="duotone" className="h-5 w-5 text-emerald-500" />
          <span>No open todos. Nice.</span>
        </div>
      ) : (
        <>
          {staleCount > 0 ? (
            <p
              className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200"
              data-testid="home-todos-stale-reminder"
            >
              {staleCount} {staleCount === 1 ? "todo has" : "todos have"} been open for more than 7
              days.
            </p>
          ) : null}

          <ul className="divide-y divide-[var(--color-noxe-border)] rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
            {preview.map((todo) => (
              <li key={todo.id}>
                <div className="flex items-start gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggle(todo.id)}
                    aria-label={`Mark "${todo.text}" as done`}
                    className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--color-noxe-border)] hover:border-emerald-500 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    onClick={onOpenAll}
                    className="flex-1 text-left text-sm text-[var(--color-noxe-ink)] hover:underline"
                  >
                    {todo.text}
                  </button>
                  {isStale(todo) ? (
                    <span
                      className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      title={`Open since ${formatRelativeAge(todo.createdAt)}`}
                    >
                      stale
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between text-xs text-[var(--color-noxe-muted)]">
            <span>{overflow > 0 ? `+${overflow} more` : ""}</span>
            <button
              type="button"
              onClick={onOpenAll}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
            >
              <ListChecks className="h-4 w-4" /> Open todos
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function isStale(todo: Todo): boolean {
  const created = Date.parse(todo.createdAt);
  if (Number.isNaN(created)) return false;
  return Date.now() - created > STALE_THRESHOLD_MS;
}

function formatRelativeAge(iso: string): string {
  const created = Date.parse(iso);
  if (Number.isNaN(created)) return iso;
  const days = Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
