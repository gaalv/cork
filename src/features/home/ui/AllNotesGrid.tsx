import { useEffect, useRef } from "react";

import { useBulkSelection } from "@/features/folder-ops/hooks/useBulkSelection";

import { NoteCard } from "./NoteCard";

import type { NoteEntry } from "@/shared/ipc/types";

type AllNotesGridProps = {
  notes: NoteEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  onOpen: (note: NoteEntry) => void;
  onPinToggle: (note: NoteEntry) => Promise<void> | void;
  onChanged?: () => void;
};

export function AllNotesGrid({ notes, hasMore, onLoadMore, onOpen, onPinToggle, onChanged }: AllNotesGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const bulkSelection = useBulkSelection(notes.map((note) => note.path));

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    }, { rootMargin: "240px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return (
    <section aria-labelledby="home-all-notes-heading" className="space-y-3">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">All notes</p>
        <h2 id="home-all-notes-heading" className="text-lg font-semibold">
          Browse vault
        </h2>
      </div>
      {notes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-noxe-border)] p-5 text-sm text-[var(--color-noxe-muted)]">
          No notes have been indexed yet.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={onOpen}
              onPinToggle={onPinToggle}
              onChanged={onChanged}
              selected={bulkSelection.isSelected(note.path)}
              onSelectClick={(event, selectedNote) => bulkSelection.handleClick(event.nativeEvent, selectedNote.path)}
            />
          ))}
        </div>
      )}
      {hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-4" data-testid="all-notes-sentinel">
          <button
            type="button"
            onClick={onLoadMore}
            className="rounded-full border border-[var(--color-noxe-border)] px-4 py-2 text-sm hover:border-[var(--color-noxe-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
          >
            Load more notes
          </button>
        </div>
      ) : null}
    </section>
  );
}
