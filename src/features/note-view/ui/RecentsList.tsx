import type { NoteEntry } from "@/shared/ipc/types";

type NoteViewRecentsListProps = {
  notes: NoteEntry[];
  currentNoteId?: string | null;
  onOpen: (note: NoteEntry) => void;
};

export function RecentsList({ notes, currentNoteId, onOpen }: NoteViewRecentsListProps) {
  const visible = notes.filter((note) => note.id !== currentNoteId).slice(0, 5);
  return (
    <section aria-labelledby="note-recents-heading" className="space-y-2">
      <h2 id="note-recents-heading" className="text-sm font-semibold">Recent notes</h2>
      {visible.length === 0 ? <p className="text-sm text-[var(--color-noxe-muted)]">No other recent notes.</p> : null}
      <ul className="space-y-1">
        {visible.map((note) => (
          <li key={note.id}>
            <button type="button" onClick={() => onOpen(note)} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-noxe-panel-2)]">
              {note.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
