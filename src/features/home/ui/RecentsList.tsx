import type { NoteEntry } from "@/shared/ipc/types";

type RecentsListProps = {
  notes: NoteEntry[];
  onOpen: (note: NoteEntry) => void;
};

export function RecentsList({ notes, onOpen }: RecentsListProps) {
  return (
    <section aria-labelledby="home-recents-heading" className="space-y-3">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Recents</p>
        <h2 id="home-recents-heading" className="text-lg font-semibold">
          Recently updated
        </h2>
      </div>
      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-noxe-border)] p-5 text-sm text-[var(--color-noxe-muted)]">
          Recent notes will appear here after the vault is indexed.
        </p>
      ) : (
        <ol className="divide-y divide-[var(--color-noxe-border)] rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => onOpen(note)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
              >
                <span>
                  <span className="block font-medium text-[var(--color-noxe-ink)]">{note.title}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-noxe-muted)]">{note.folder || "Inbox"}</span>
                </span>
                <time className="shrink-0 text-xs text-[var(--color-noxe-muted)]" dateTime={new Date(note.mtime).toISOString()}>
                  {formatDate(note.mtime)}
                </time>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatDate(mtime: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(mtime));
}
