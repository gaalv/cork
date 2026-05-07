import { ArrowLeft, Command as CommandIcon, Plus, Star, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { toggleStar } from "@/features/drawers/services/starService";
import { flushEditorSave } from "@/features/editor/hooks/useAutoSave";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { InlineRename } from "@/features/folder-ops/ui/InlineRename";
import { createAndOpenNote } from "@/features/note-ops/services/createAndOpenNote";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { VaultSwitcher } from "@/features/vault-switcher/ui/VaultSwitcher";
import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

export function TopBar() {
  const view = useShellStore((state) => state.view);
  const navigate = useShellStore((state) => state.navigate);
  const openPalette = useShellStore((state) => state.openPalette);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);
  const pushToast = useShellStore((state) => state.pushToast);
  const vaultPath = useVaultStore((state) => state.path);
  const notes = useVaultStore((state) => state.notes);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const activeNote = view.kind === "note" ? notes.find((note) => note.id === view.id) : null;
  const activeBuffer = useEditorStore((state) => (view.kind === "note" ? state.buffers.get(view.id) ?? null : null));
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);
  const [busyStar, setBusyStar] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const vaultName = vaultPath ? vaultPath.split(/[\\/]/).filter(Boolean).at(-1) ?? "Vault" : "No vault open";

  const starred = activeBuffer?.frontmatter.starred === true;

  async function onToggleStar() {
    if (!activeNote || busyStar) return;
    setBusyStar(true);
    try {
      if (activeBuffer) {
        updateFrontmatter(activeNote.id, { starred: !starred });
        // Persist immediately so the indexer can refresh derived views
        // (Starred drawer, etc.) without waiting for the autosave debounce.
        await flushEditorSave(activeNote.id);
      } else {
        await toggleStar(activeNote);
        await loadNotes();
      }
    } catch (error) {
      pushToast({ title: "Failed to toggle star", description: (error as Error).message ?? "Unknown error" });
    } finally {
      setBusyStar(false);
    }
  }

  async function onDeleteNote() {
    if (!activeNote || busyDelete) return;
    const ok = window.confirm(
      `Move "${activeNote.title}" to system trash?\n\nIt will be removed from this vault and can be restored from your operating system trash.`,
    );
    if (!ok) return;
    setBusyDelete(true);
    try {
      await client.notes.trash(activeNote.path);
      await loadNotes();
      navigate({ kind: "home" });
    } catch (error) {
      pushToast({ title: "Failed to delete note", description: (error as Error).message ?? "Unknown error" });
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <header
      data-testid="topbar"
      className="relative z-50 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]/80 px-6 backdrop-blur"
    >
      {view.kind === "note" ? (
        <button
          type="button"
          onClick={() => navigate({ kind: "home" })}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <ArrowLeft size={12} /> Home
        </button>
      ) : (
        <VaultSwitcher />
      )}

      {view.kind === "note" && (
        <Breadcrumb
          vaultName={vaultName}
          folder={activeNote?.folder ? activeNote.folder : "Inbox"}
          note={activeNote ?? null}
          title={activeNote?.title ?? "Untitled"}
          onFolderClick={() => toggleDrawer("folders")}
        />
      )}

      {view.kind === "note" && (
        <button
          type="button"
          aria-label={starred ? "Remove star" : "Star note"}
          aria-pressed={starred}
          title={starred ? "Unstar note" : "Star note"}
          disabled={busyStar || !activeNote}
          onClick={() => void onToggleStar()}
          className={`ml-1 rounded-full p-1.5 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-50 ${
            starred
              ? "bg-[var(--color-noxe-panel-2)] text-yellow-500"
              : "text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
          }`}
        >
          <Star size={16} weight={starred ? "fill" : "regular"} />
        </button>
      )}

      {view.kind === "note" && (
        <button
          type="button"
          aria-label="Delete note"
          title="Delete note (⌘⌫)"
          disabled={busyDelete || !activeNote}
          onClick={() => void onDeleteNote()}
          className="rounded-full p-1.5 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-red-500 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-50"
        >
          <Trash size={16} />
        </button>
      )}

      <button
        type="button"
        onClick={openPalette}
        className="ml-auto flex w-[min(420px,45vw)] items-center gap-2 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-1.5 text-left text-[13px] text-[var(--color-noxe-muted)] hover:border-[var(--color-noxe-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        <CommandIcon size={14} />
        <span>Go to note, command or search…</span>
        <span className="ml-auto flex items-center gap-1" aria-hidden="true">
          <kbd className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-kbd)] px-1 text-[10px] font-medium">⌘</kbd>
          <kbd className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-kbd)] px-1 text-[10px] font-medium">K</kbd>
        </span>
      </button>

      <button
        type="button"
        onClick={() => void createAndOpenNote()}
        className="flex items-center gap-1.5 rounded-full bg-[var(--color-noxe-primary)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-noxe-primary-foreground)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        <Plus size={12} weight="bold" /> New note
      </button>
    </header>
  );
}

type BreadcrumbProps = {
  vaultName: string;
  folder: string;
  note: NoteEntry | null;
  title: string;
  onFolderClick: () => void;
};

function Breadcrumb({ vaultName, folder, note, title, onFolderClick }: BreadcrumbProps) {
  const [editing, setEditing] = useState(false);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const navigate = useShellStore((state) => state.navigate);

  async function renameNote(nextTitle: string) {
    if (!note) {
      return;
    }
    const result = await client.notes.rename({ oldPath: note.path, newName: nextTitle });
    await loadNotes();
    const renamed = useVaultStore.getState().notes.find((entry) => entry.path === result.path);
    if (renamed) {
      navigate({ kind: "note", id: renamed.id });
    }
    setEditing(false);
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-[13px] text-[var(--color-noxe-muted)]">
      <span className="truncate">{vaultName}</span>
      <span aria-hidden="true">/</span>
      <button
        type="button"
        onClick={onFolderClick}
        className="truncate rounded px-1 py-0.5 hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
      >
        {folder || "Inbox"}
      </button>
      <span aria-hidden="true">/</span>
      {editing ? (
        <InlineRename
          initial={title}
          label="Rename active note"
          validate={validateNoteTitle}
          onCommit={renameNote}
          onCancel={() => setEditing(false)}
          className="font-medium text-[var(--color-noxe-ink)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="truncate rounded px-1 py-0.5 font-medium text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          {title}
        </button>
      )}
    </nav>
  );
}

function validateNoteTitle(title: string): string | null {
  if (title.length === 0) {
    return "Note title is required";
  }
  if (/[\\/:*?"<>|]/.test(title)) {
    return "Note title cannot contain path separators or reserved characters";
  }
  return null;
}
