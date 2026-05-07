import { useMemo } from "react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useFolderTree } from "@/features/drawers/hooks/useFolderTree";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { cn } from "@/shared/utils/cn";

import { FolderNode } from "./FolderNode";

type FoldersDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function FoldersDrawer({ onOpenNote }: FoldersDrawerProps) {
  const notes = useVaultStore((state) => state.notes);
  const tree = useFolderTree();
  const selectedFolder = useDrawersStore((state) => state.selectedFolder);
  const selectFolder = useDrawersStore((state) => state.selectFolder);
  const rootNotes = useMemo(() => notes.filter((note) => !note.folder).sort((a, b) => a.title.localeCompare(b.title)), [notes]);

  if (notes.length === 0) {
    return <p className="text-sm text-[var(--color-noxe-muted)]">No notes in this vault yet.</p>;
  }

  return (
    <section
      role="region"
      aria-label="Folders drawer"
      className="space-y-3 text-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedFolder !== null) {
          event.preventDefault();
          selectFolder(null);
        }
      }}
    >
      <button
        type="button"
        onClick={() => selectFolder(null)}
        className={cn(
          "inline-flex items-center rounded-full border border-[var(--color-noxe-border)] px-3 py-1 text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)]",
          selectedFolder === null && "bg-[var(--color-noxe-panel-2)] text-[var(--color-noxe-ink)] ring-1 ring-[var(--color-noxe-ring)]",
        )}
        aria-pressed={selectedFolder === null}
      >
        Root {selectedFolder === null ? "(default for new notes)" : ""}
      </button>
      {rootNotes.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--color-noxe-muted)]">Root</p>
          <div className="space-y-0.5">
            {rootNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-noxe-panel-2)]"
                onClick={() => onOpenNote?.(note.id)}
              >
                {note.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {tree.length > 0 ? (
        <ul role="tree" aria-label="Folder tree" className="space-y-0.5">
          {tree.map((node) => (
            <FolderNode key={node.path} node={node} onOpenNote={onOpenNote} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
