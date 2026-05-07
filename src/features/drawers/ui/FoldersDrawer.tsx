import { useMemo } from "react";
import { Tray } from "@phosphor-icons/react";

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
  const inboxSelected = selectedFolder === null;

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
      <div>
        <button
          type="button"
          onClick={() => selectFolder(null)}
          aria-pressed={inboxSelected}
          aria-label="Inbox"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-2.5 py-1.5 text-left text-xs text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel)]",
            inboxSelected && "ring-1 ring-[var(--color-noxe-ring)]",
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            <Tray size={14} weight="duotone" /> Inbox
          </span>
          <span className="text-[11px] text-[var(--color-noxe-muted)]">{rootNotes.length}</span>
        </button>
        {inboxSelected && rootNotes.length > 0 ? (
          <ul className="mt-1 space-y-0.5" aria-label="Inbox notes">
            {rootNotes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className="block w-full rounded-md px-2 py-1 text-left text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
                  onClick={() => onOpenNote?.(note.id)}
                >
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
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
