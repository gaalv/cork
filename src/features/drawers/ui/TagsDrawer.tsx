import { useEffect, useState } from "react";
import { Info } from "@phosphor-icons/react";

import { useTagTree } from "@/features/drawers/hooks/useTagTree";
import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useShellStore } from "@/features/shell/state/shellStore";
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
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);
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

  return (
    <section role="region" aria-label="Tags drawer" className="space-y-3 text-sm">
      <div className="flex items-start gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-2.5 text-[11px] text-[var(--color-noxe-muted)]">
        <Info size={14} weight="duotone" className="mt-0.5 shrink-0" />
        <span>
          Add tags from the right sidebar of any note. They will appear here automatically. <button
            type="button"
            className="text-[var(--color-noxe-accent)] hover:underline"
            onClick={() => toggleDrawer("folders")}
          >Open folders</button> to find a note.
        </span>
      </div>
      {tree.length === 0 ? (
        <p className="text-sm text-[var(--color-noxe-muted)]">No tags in this vault yet.</p>
      ) : (
        <ul role="tree" aria-label="Tag tree" className="space-y-0.5">
          {tree.map((node) => (
            <TagNode key={node.tag} node={node} onSelectTag={selectTag} />
          ))}
        </ul>
      )}
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
