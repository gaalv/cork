import { useMemo, useState } from "react";
import { FilePlus, FolderPlus, Tray } from "@phosphor-icons/react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useFolderTree } from "@/features/drawers/hooks/useFolderTree";
import { folderOps } from "@/features/folder-ops/services/folderOps";
import { NewFolderDialog } from "@/features/folder-ops/ui/NewFolderDialog";
import { createAndOpenNote } from "@/features/note-ops/services/createAndOpenNote";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { resolveNoteIcon } from "@/shared/ui/noteIcons";

import { FolderNode } from "./FolderNode";

type FoldersDrawerProps = {
  onOpenNote?: (id: string) => void;
};

export function FoldersDrawer({ onOpenNote }: FoldersDrawerProps) {
  const notes = useVaultStore((state) => state.notes);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const tree = useFolderTree();
  const selectedFolder = useDrawersStore((state) => state.selectedFolder);
  const selectFolder = useDrawersStore((state) => state.selectFolder);
  const closeDrawer = useShellStore((state) => state.closeDrawer);
  const rootNotes = useMemo(() => notes.filter((note) => !note.folder).sort((a, b) => a.title.localeCompare(b.title)), [notes]);
  const inboxSelected = selectedFolder === null;
  const [busy, setBusy] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  async function handleCreateFolder(parent: string, name: string) {
    setBusy(true);
    try {
      await folderOps.create({ parent, name });
      await loadNotes();
    } finally {
      setBusy(false);
    }
  }

  async function newInboxNote() {
    setBusy(true);
    try {
      await createAndOpenNote({ folder: "" });
      closeDrawer();
    } finally {
      setBusy(false);
    }
  }

  if (notes.length === 0 && tree.length === 0) {
    return (
      <section className="space-y-3">
        <DrawerToolbar busy={busy} onNewFolder={() => setNewFolderOpen(true)} onNewNote={() => void newInboxNote()} />
        <p className="text-sm text-[var(--color-noxe-muted)]">No notes in this vault yet.</p>
        <NewFolderDialog
          open={newFolderOpen}
          parent=""
          onCreate={handleCreateFolder}
          onClose={() => setNewFolderOpen(false)}
        />
      </section>
    );
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
      <DrawerToolbar busy={busy} onNewFolder={() => setNewFolderOpen(true)} onNewNote={() => void newInboxNote()} />
      <div>
        <button
          type="button"
          onClick={() => selectFolder(null)}
          aria-pressed={inboxSelected}
          aria-label="Inbox"
          className="group flex w-full items-center gap-1 rounded-md py-1 pr-1 pl-1 text-left text-sm hover:bg-[var(--color-noxe-panel-2)]"
        >
          <span className="grid h-5 w-4 shrink-0 place-items-center" aria-hidden />
          <Tray size={14} weight="duotone" className="shrink-0 text-[var(--color-noxe-muted)]" />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-noxe-ink)]">Inbox</span>
          <span className="shrink-0 text-[11px] text-[var(--color-noxe-muted)]">{rootNotes.length}</span>
          <span className="grid h-6 w-6 shrink-0 place-items-center" aria-hidden />
        </button>
        {inboxSelected && rootNotes.length > 0 ? (
          <ul className="mt-1 space-y-0.5" aria-label="Inbox notes">
            {rootNotes.map((note) => {
              const NoteIcon = resolveNoteIcon(undefined);
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
                    onClick={() => onOpenNote?.(note.id)}
                  >
                    <NoteIcon size={12} weight="duotone" className="shrink-0" />
                    <span className="truncate">{note.title}</span>
                  </button>
                </li>
              );
            })}
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
      <NewFolderDialog
        open={newFolderOpen}
        parent=""
        onCreate={handleCreateFolder}
        onClose={() => setNewFolderOpen(false)}
      />
    </section>
  );
}

type DrawerToolbarProps = {
  busy: boolean;
  onNewFolder: () => void;
  onNewNote: () => void;
};

function DrawerToolbar({ busy, onNewFolder, onNewNote }: DrawerToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-noxe-muted)]">Vault</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="New note in inbox"
          title="New note in inbox"
          disabled={busy}
          onClick={onNewNote}
          className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-50"
        >
          <FilePlus size={14} />
        </button>
        <button
          type="button"
          aria-label="New folder at root"
          title="New folder at root"
          disabled={busy}
          onClick={onNewFolder}
          className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-50"
        >
          <FolderPlus size={14} />
        </button>
      </div>
    </div>
  );
}
