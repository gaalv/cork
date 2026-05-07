import { NoteCard } from "./NoteCard";

import type { HomeNote } from "@/features/home/hooks/useHomeSections";
import type { NoteEntry } from "@/shared/ipc/types";

type PinnedGridProps = {
  notes: HomeNote[];
  onOpen: (note: NoteEntry) => void;
  onPinToggle: (note: NoteEntry) => Promise<void> | void;
  onChanged?: () => void;
};

export function PinnedGrid({ notes, onOpen, onPinToggle, onChanged }: PinnedGridProps) {
  return (
    <section aria-labelledby="home-starred-heading" className="space-y-3">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Starred</p>
        <h2 id="home-starred-heading" className="text-lg font-semibold">
          Start here
        </h2>
      </div>
      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-noxe-border)] p-5 text-sm text-[var(--color-noxe-muted)]">
          Star important notes to keep them one click away.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={onOpen} onPinToggle={onPinToggle} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}
