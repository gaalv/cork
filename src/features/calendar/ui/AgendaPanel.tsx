import { X } from "@phosphor-icons/react";
import type { NoteSummary } from "../services/calendarService";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type AgendaPanelProps = {
  date: Date;
  notes: NoteSummary[];
  hasDailyNote: boolean;
  onOpenNote: (id: string) => void;
  onCreateDailyNote: () => void;
  onClose: () => void;
};

export function AgendaPanel({ date, notes, hasDailyNote, onOpenNote, onCreateDailyNote, onClose }: AgendaPanelProps) {
  const dow = DAY_NAMES[date.getDay()]!;
  const monthName = MONTH_NAMES[date.getMonth()]!;
  const heading = `${dow}, ${monthName} ${date.getDate()}, ${date.getFullYear()}`;

  return (
    <aside
      aria-label="Agenda"
      data-testid="agenda-panel"
      className="flex h-full w-64 shrink-0 flex-col gap-3 overflow-y-auto border-l border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--color-noxe-ink)]">{heading}</h2>
        <button
          type="button"
          aria-label="Close agenda"
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <X size={14} />
        </button>
      </div>

      {notes.length > 0 ? (
        <ul className="flex flex-col gap-1" role="list">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                onClick={() => onOpenNote(note.id)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
              >
                {note.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-noxe-muted)]">No notes for this day.</p>
      )}

      {!hasDailyNote && (
        <button
          type="button"
          onClick={onCreateDailyNote}
          className="mt-auto rounded-md bg-[var(--color-noxe-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-noxe-primary-foreground)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          Create daily note
        </button>
      )}
    </aside>
  );
}
