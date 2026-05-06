import { NoteCardMenu } from "./NoteCardMenu";

import type { HomeNote } from "@/features/home/hooks/useHomeSections";
import type { NoteEntry } from "@/shared/ipc/types";

type NoteCardProps = {
  note: NoteEntry | HomeNote;
  onOpen: (note: NoteEntry) => void;
  onPinToggle: (note: NoteEntry) => Promise<void> | void;
  onChanged?: () => void;
};

export function NoteCard({ note, onOpen, onPinToggle, onChanged }: NoteCardProps) {
  const homeNote = isHomeNote(note) ? note : null;
  const pinned = homeNote?.pinned ?? false;
  const starred = homeNote?.starred ?? false;
  const snippet = homeNote?.snippet ?? (note.folder || "No preview available");

  return (
    <article className="group rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 transition hover:border-[var(--color-noxe-border-strong)] hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen(note)}
          className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <span className="block truncate font-medium text-[var(--color-noxe-ink)]">{note.title}</span>
          <span className="mt-2 line-clamp-2 block text-sm text-[var(--color-noxe-muted)]">{snippet}</span>
        </button>
        <NoteCardMenu note={note} pinned={pinned} starred={starred} onOpen={onOpen} onPinToggle={onPinToggle} onChanged={onChanged} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-noxe-muted)]">
        {pinned ? <Badge>Pinned</Badge> : null}
        {starred ? <Badge>Starred</Badge> : null}
        {note.folder ? <Badge>{note.folder}</Badge> : null}
        <time dateTime={new Date(note.mtime).toISOString()}>{formatDate(note.mtime)}</time>
      </div>
    </article>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="rounded-full bg-[var(--color-noxe-panel-2)] px-2 py-0.5">{children}</span>;
}

function isHomeNote(note: NoteEntry | HomeNote): note is HomeNote {
  return "frontmatter" in note;
}

function formatDate(mtime: number): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(mtime));
}
