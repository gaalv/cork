import { useMemo } from "react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useFolderTree } from "@/features/drawers/hooks/useFolderTree";
import { DEFAULT_INBOX_FOLDER } from "@/features/note-ops/services/createAndOpenNote";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { cn } from "@/shared/utils/cn";

import { FolderNode } from "./FolderNode";

type FoldersDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function FoldersDrawer({ onOpenNote }: FoldersDrawerProps) {
  const notes = useVaultStore((state) => state.notes);
  const fullTree = useFolderTree();
  const selectedFolder = useDrawersStore((state) => state.selectedFolder);
  const selectFolder = useDrawersStore((state) => state.selectFolder);
  const rootNotes = useMemo(() => notes.filter((note) => !note.folder).sort((a, b) => a.title.localeCompare(b.title)), [notes]);
  const tree = useMemo(() => fullTree.filter((node) => node.path !== DEFAULT_INBOX_FOLDER), [fullTree]);
  const inboxNotes = useMemo(
    () => notes.filter((note) => note.folder === DEFAULT_INBOX_FOLDER).sort((a, b) => a.title.localeCompare(b.title)),
    [notes],
  );
  const inboxSelected = selectedFolder === DEFAULT_INBOX_FOLDER;

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
      <div>
        <button
          type="button"
          onClick={() => selectFolder(inboxSelected ? null : DEFAULT_INBOX_FOLDER)}
          aria-pressed={inboxSelected}
          aria-label="Inbox"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-2.5 py-1.5 text-left text-xs text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel)]",
            inboxSelected && "ring-1 ring-[var(--color-noxe-ring)]",
          )}
        >
          <span className="font-medium">Inbox</span>
          <span className="text-[11px] text-[var(--color-noxe-muted)]">{inboxNotes.length}</span>
        </button>
        {inboxSelected && inboxNotes.length > 0 ? (
          <ul className="mt-1 space-y-0.5" aria-label="Inbox notes">
            {inboxNotes.map((note) => (
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
