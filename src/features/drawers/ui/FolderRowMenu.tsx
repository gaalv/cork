import { useEffect, useRef, useState } from "react";
import { DotsThreeVertical } from "@phosphor-icons/react";

import { folderOps, validateFolderName } from "@/features/folder-ops/services/folderOps";
import { useVaultStore } from "@/features/vault/state/vaultStore";

type FolderRowMenuProps = {
  path: string;
  name: string;
  onRequestRename: () => void;
};

export function FolderRowMenu({ path, name, onRequestRename }: FolderRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const newSubfolder = async () => {
    const raw = window.prompt(`Create new folder inside "${name}"`);
    if (raw === null) return close();
    const trimmed = raw.trim();
    const validationError = validateFolderName(trimmed);
    if (validationError) {
      window.alert(validationError);
      return close();
    }
    setBusy(true);
    try {
      await folderOps.create({ parent: path, name: trimmed });
      await loadNotes();
    } catch (error) {
      window.alert((error as Error).message ?? "Failed to create folder");
    } finally {
      setBusy(false);
      close();
    }
  };

  const trashFolder = async () => {
    const ok = window.confirm(`Move folder "${name}" to trash?`);
    if (!ok) return close();
    setBusy(true);
    try {
      await folderOps.trash(path);
      await loadNotes();
    } catch (error) {
      window.alert((error as Error).message ?? "Failed to move folder to trash");
    } finally {
      setBusy(false);
      close();
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
          <MenuItem disabled={busy} onSelect={() => void newSubfolder()}>New subfolder</MenuItem>
          <MenuItem disabled={busy} destructive onSelect={() => void trashFolder()}>Move to trash</MenuItem>
        </div>
      ) : null}
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
