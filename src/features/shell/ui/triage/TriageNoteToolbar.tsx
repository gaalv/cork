import { Star, Trash } from "@phosphor-icons/react";
import { useState } from "react";

import { toggleStar } from "@/features/drawers/services/starService";
import { flushEditorSave } from "@/features/editor/hooks/useAutoSave";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

type TriageNoteToolbarProps = {
  noteId: string;
};

export function TriageNoteToolbar({ noteId }: TriageNoteToolbarProps) {
  const notes = useVaultStore((state) => state.notes);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const navigate = useShellStore((state) => state.navigate);
  const pushToast = useShellStore((state) => state.pushToast);
  const buffer = useEditorStore((state) => state.buffers.get(noteId) ?? null);
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);

  const note = notes.find((entry) => entry.id === noteId) ?? null;
  const starred = buffer?.frontmatter.starred === true;
  const [busyStar, setBusyStar] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  async function onToggleStar() {
    if (!note || busyStar) return;
    setBusyStar(true);
    try {
      if (buffer) {
        updateFrontmatter(note.id, { starred: !starred });
        await flushEditorSave(note.id);
      } else {
        await toggleStar(note);
        await loadNotes();
      }
    } catch (error) {
      pushToast({
        title: "Failed to toggle star",
        description: (error as Error).message ?? "Unknown error",
      });
    } finally {
      setBusyStar(false);
    }
  }

  async function onDeleteNote() {
    if (!note || busyDelete) return;
    const ok = window.confirm(
      `Move "${note.title}" to system trash?\n\nIt will be removed from this vault and can be restored from your operating system trash.`,
    );
    if (!ok) return;
    setBusyDelete(true);
    try {
      await client.notes.trash(note.path);
      await loadNotes();
      navigate({ kind: "home" });
    } catch (error) {
      pushToast({
        title: "Failed to delete note",
        description: (error as Error).message ?? "Unknown error",
      });
    } finally {
      setBusyDelete(false);
    }
  }

  const folder = note?.folder || "Inbox";
  const filename = note?.path.split("/").pop() ?? note?.title ?? "Untitled";

  return (
    <div
      data-testid="triage-note-toolbar"
      className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-5 text-sm text-[var(--color-noxe-muted)]"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate">{folder}</span>
        <span aria-hidden="true">/</span>
        <span className="truncate text-[var(--color-noxe-ink)]">{filename}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={starred ? "Unstar note" : "Star note"}
          aria-pressed={starred}
          title={starred ? "Unstar note" : "Star note"}
          disabled={busyStar || !note}
          onClick={() => void onToggleStar()}
          className={`rounded p-1.5 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-50 ${
            starred
              ? "bg-[var(--color-noxe-panel-2)] text-yellow-500"
              : "text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
          }`}
        >
          <Star size={14} weight={starred ? "fill" : "regular"} />
        </button>
        <button
          type="button"
          aria-label="Delete note"
          title="Delete note"
          disabled={busyDelete || !note}
          onClick={() => void onDeleteNote()}
          className="rounded p-1.5 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-red-500 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none disabled:opacity-50"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
}
