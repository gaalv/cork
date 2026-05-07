import { useEffect, useRef, useState } from "react";
import { DotsThreeVertical } from "@phosphor-icons/react";

import { folderOps } from "@/features/folder-ops/services/folderOps";
import { NewFolderDialog } from "@/features/folder-ops/ui/NewFolderDialog";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

type FolderRowMenuProps = {
  path: string;
  name: string;
  onRequestRename: () => void;
};

export function FolderRowMenu({ path, name, onRequestRename }: FolderRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const loadNotes = useVaultStore((state) => state.loadNotes);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const close = () => setOpen(false);

  const handleCreateSubfolder = async (parent: string, subName: string) => {
    setBusy(true);
    try {
      await folderOps.create({ parent, name: subName });
      await loadNotes();
    } finally {
      setBusy(false);
    }
  };

  const confirmTrash = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      await folderOps.trash(path);
      await loadNotes();
      setTrashOpen(false);
    } catch (error) {
      setErrorMessage((error as Error).message ?? "Failed to move folder to trash");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions for ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md p-1 text-[var(--color-noxe-muted)] opacity-0 hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none group-hover:opacity-100"
      >
        <DotsThreeVertical size={14} weight="bold" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`Folder actions for ${name}`}
          className="absolute top-full right-0 z-30 mt-1 w-44 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-1 text-xs shadow-lg"
        >
          <MenuItem disabled={busy} onSelect={() => { onRequestRename(); close(); }}>Rename</MenuItem>
          <MenuItem disabled={busy} onSelect={() => { setNewSubOpen(true); close(); }}>New subfolder</MenuItem>
          <MenuItem disabled={busy} destructive onSelect={() => { setTrashOpen(true); close(); }}>Move to trash</MenuItem>
        </div>
      ) : null}
      <NewFolderDialog
        open={newSubOpen}
        parent={path}
        onCreate={handleCreateSubfolder}
        onClose={() => setNewSubOpen(false)}
      />
      <ConfirmDialog
        open={trashOpen}
        title={`Move "${name}" to trash?`}
        message={errorMessage ?? "The folder and all of its notes will be moved to the system trash."}
        confirmLabel="Move to trash"
        destructive
        onCancel={() => { setTrashOpen(false); setErrorMessage(null); }}
        onConfirm={() => void confirmTrash()}
      />
    </div>
  );
}

type MenuItemProps = {
  children: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

function MenuItem({ children, disabled = false, destructive = false, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`block w-full rounded-md px-2.5 py-1.5 text-left disabled:opacity-50 ${
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
      }`}
    >
      {children}
    </button>
  );
}
