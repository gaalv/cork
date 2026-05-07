import { useEffect, useMemo, useState } from "react";

import { useAutoSave } from "@/features/editor/hooks/useAutoSave";
import { useExternalReconciler } from "@/features/editor/hooks/useExternalReconciler";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { Editor } from "@/features/editor/ui/Editor";
import { InlineRename } from "@/features/folder-ops/ui/InlineRename";
import { NoteMetaPanel } from "@/features/note-view/ui/NoteMetaPanel";
import { useNoteViewStore } from "@/features/note-view/state/noteViewStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

export type NoteViewProps = {
  noteId: string;
  title: string;
};

export function NoteView({ noteId, title }: NoteViewProps) {
  const note = useVaultStore((state) => state.notes.find((candidate) => candidate.id === noteId));
  const notes = useVaultStore((state) => state.notes);
  const navigate = useShellStore((state) => state.navigate);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const openBuffer = useEditorStore((state) => state.openBuffer);
  const buffer = useEditorStore((state) => state.buffers.get(noteId));
  const setActiveNotePath = useNoteViewStore((state) => state.setActiveNotePath);
  const toggleLiveMode = useNoteViewStore((state) => state.toggleLiveMode);
  const [editingTitle, setEditingTitle] = useState(false);
  useAutoSave();
  useExternalReconciler();

  useEffect(() => {
    setActiveNotePath(note?.path ?? null);
    return () => setActiveNotePath(null);
  }, [note?.path, setActiveNotePath]);

  useEffect(() => {
    if (!note || buffer?.dirty) {
      return;
    }
    let cancelled = false;
    void client.notes
      .read(note.path)
      .catch(() => ({ path: note.path, frontmatter: {}, body: fixtureBody(note), mtime: note.mtime }))
      .then((file) => {
        if (!cancelled) {
          openBuffer({ noteId, file });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [buffer?.dirty, note, noteId, openBuffer]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        toggleLiveMode(noteId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noteId, toggleLiveMode]);

  async function renameTitle(next: string) {
    if (!note) {
      return;
    }
    const result = await client.notes.rename({ oldPath: note.path, newName: next });
    await loadNotes();
    const renamed = useVaultStore.getState().notes.find((entry) => entry.path === result.path);
    if (renamed) {
      navigate({ kind: "note", id: renamed.id });
    }
    setEditingTitle(false);
  }

  const recents = useMemo(() => [...notes].sort((left, right) => right.mtime - left.mtime), [notes]);
  const openNote = (entry: NoteEntry) => navigate({ kind: "note", id: entry.id });

  return (
    <main className="relative flex flex-1 overflow-hidden" data-testid="note-view">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden p-6 lg:p-10">
        <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Note</p>
        {editingTitle ? (
          <InlineRename
            initial={title}
            label="Rename note"
            onCommit={renameTitle}
            onCancel={() => setEditingTitle(false)}
            className="mt-1 text-2xl font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTitle(true)}
            className="mt-1 -ml-1 max-w-full truncate rounded px-1 text-left text-2xl font-semibold text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
            aria-label={`Rename note "${title}"`}
          >
            {title}
          </button>
        )}
        <div className="mt-4 min-h-0 flex-1">
          <Editor className="h-full min-h-0" />
        </div>
      </section>
      <NoteMetaPanel
        noteId={noteId}
        body={buffer?.body ?? ""}
        recents={recents}
        updated={buffer?.loadedMtime ?? note?.mtime}
        created={typeof buffer?.frontmatter.created === "string" ? buffer.frontmatter.created : undefined}
        onOpenNote={openNote}
      />
    </main>
  );
}

function fixtureBody(note: { title: string; body?: unknown }): string {
  return typeof note.body === "string" ? note.body : `# ${note.title}\n`;
}
