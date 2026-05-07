import { useEffect, useRef, useState } from "react";

import { toggleStar } from "@/features/drawers/services/starService";
import { useShellStore } from "@/features/shell/state/shellStore";
import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

type NoteCardMenuProps = {
  note: NoteEntry;
  pinned?: boolean;
  starred?: boolean;
  onOpen: (note: NoteEntry) => void;
  onPinToggle: (note: NoteEntry) => Promise<void> | void;
  onChanged?: () => void;
};

export function NoteCardMenu({ note, starred = false, onOpen, onChanged }: NoteCardMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const runAction = async (action: () => Promise<void> | void) => {
    setBusy(true);
    try {
      await action();
      onChanged?.();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Open menu for ${note.title}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md px-2 py-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`Actions for ${note.title}`}
          className="absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-1 text-sm shadow-lg"
        >
          <MenuButton onSelect={() => { onOpen(note); setOpen(false); }}>Open</MenuButton>
          <MenuButton disabled={busy} onSelect={() => runAction(async () => { void (await toggleStar(note)); })}>
            {starred ? "Unstar" : "Star"}
          </MenuButton>
          <MenuButton onSelect={() => { toggleDrawer("folders"); setOpen(false); }}>Reveal in Folders</MenuButton>
          <MenuButton onSelect={() => { navigator.clipboard?.writeText(note.path); setOpen(false); }}>Copy Path</MenuButton>
          <MenuButton disabled={busy} destructive onSelect={() => runAction(() => client.notes.trash(note.path))}>
            Delete
          </MenuButton>
        </div>
      ) : null}
    </div>
  );
}

type MenuButtonProps = {
  children: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => Promise<void> | void;
};

function MenuButton({ children, disabled = false, destructive = false, onSelect }: MenuButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => void onSelect()}
      className={`block w-full rounded-lg px-3 py-2 text-left disabled:opacity-50 ${
        destructive
          ? "text-red-600 hover:bg-red-50"
          : "text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
      }`}
    >
      {children}
    </button>
  );
}
