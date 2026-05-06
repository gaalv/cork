import { useEffect, useState } from "react";

import { useTagTree } from "@/features/drawers/hooks/useTagTree";
import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { client } from "@/shared/ipc/client";

import { TagNode } from "./TagNode";

import type { NoteEntry } from "@/shared/ipc/types";

type TagsDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function TagsDrawer({ onOpenNote }: TagsDrawerProps) {
  const { tree, isLoading, error } = useTagTree();
  const selectedTag = useDrawersStore((state) => state.selectedTag);
  const selectTag = useDrawersStore((state) => state.selectTag);
  const [notes, setNotes] = useState<NoteEntry[]>([]);

  useEffect(() => {
    if (!selectedTag) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    void client.notes.byTag(selectedTag).then((nextNotes) => {
      if (!cancelled) {
        setNotes(nextNotes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTag]);

  if (isLoading) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">Loading tags…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (tree.length === 0) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">No tags in this vault yet.</p>;
  }

  return (
    <section role="region" aria-label="Tags drawer" className="space-y-4 text-sm">
      <ul role="tree" aria-label="Tag tree" className="space-y-0.5">
        {tree.map((node) => (
          <TagNode key={node.tag} node={node} onSelectTag={selectTag} />
        ))}
      </ul>
      {selectedTag ? (
        <div className="space-y-1 border-t border-[var(--color-noxe-border)] pt-3">
          <h3 className="text-xs font-medium text-[var(--color-noxe-muted)]">#{selectedTag}</h3>
          {notes.length === 0 ? <p className="text-xs text-[var(--color-noxe-muted)]">No notes for this tag.</p> : null}
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpenNote?.(note.id)}
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-noxe-panel-2)]"
            >
              {note.title}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
