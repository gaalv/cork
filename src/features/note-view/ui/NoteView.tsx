import { useEffect, useRef } from "react";

import { useAutoSave } from "@/features/editor/hooks/useAutoSave";
import { useExternalReconciler } from "@/features/editor/hooks/useExternalReconciler";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { Editor } from "@/features/editor/ui/Editor";
import { NoteIconPicker } from "@/features/note-view/ui/NoteIconPicker";
import { NoteMetaPanel } from "@/features/note-view/ui/NoteMetaPanel";
import { useNoteViewStore } from "@/features/note-view/state/noteViewStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { ChatPanel } from "@/features/ai/ui/ChatPanel";
import { client } from "@/shared/ipc/client";

import type { NoteEntry } from "@/shared/ipc/types";

export type NoteViewProps = {
  noteId: string;
  title: string;
};

export function NoteView({ noteId, title }: NoteViewProps) {
  const note = useVaultStore((state) => state.notes.find((candidate) => candidate.id === noteId));
  const navigate = useShellStore((state) => state.navigate);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const openBuffer = useEditorStore((state) => state.openBuffer);
  const buffer = useEditorStore((state) => state.buffers.get(noteId));
  const setActiveNotePath = useNoteViewStore((state) => state.setActiveNotePath);
  const toggleLiveMode = useNoteViewStore((state) => state.toggleLiveMode);
  const titleInputRef = useRef<HTMLInputElement>(null);
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

  async function deleteNote() {
    if (!note) return;
    const ok = window.confirm(`Move "${title}" to system trash?\n\nIt will be removed from this vault and can be restored from your operating system trash.`);
    if (!ok) return;
    try {
      await client.notes.trash(note.path);
      await loadNotes();
      navigate({ kind: "home" });
    } catch (error) {
      window.alert(`Failed to delete: ${(error as Error).message ?? "unknown error"}`);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        toggleLiveMode(noteId);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, [contenteditable="true"]')) {
          return;
        }
        event.preventDefault();
        void deleteNote();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, toggleLiveMode, note?.path, title]);

  async function commitTitle(next: string) {
    if (!note) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === title) return;
    if (/[\\/:*?"<>|]/.test(trimmed)) {
      window.alert("Note title cannot contain path separators or reserved characters");
      return;
    }
    try {
      const result = await client.notes.rename({ oldPath: note.path, newName: trimmed });
      await loadNotes();
      const renamed = useVaultStore.getState().notes.find((entry) => entry.path === result.path);
      if (renamed) {
        navigate({ kind: "note", id: renamed.id });
      }
    } catch (error) {
      window.alert(`Failed to rename: ${(error as Error).message ?? "unknown error"}`);
    }
  }

  const openNote = (entry: NoteEntry) => navigate({ kind: "note", id: entry.id });

  return (
    <main className="relative flex flex-1 overflow-hidden" data-testid="note-view">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-[780px] px-8 pt-8 lg:pt-10">
          <div className="flex items-center gap-2">
            <NoteIconPicker noteId={noteId} />
            <input
              ref={titleInputRef}
              key={noteId}
              type="text"
              defaultValue={title}
              aria-label="Note title"
              placeholder="Untitled"
              spellCheck={false}
              onBlur={(event) => void commitTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.currentTarget.value = title;
                  event.currentTarget.blur();
                }
              }}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-2xl font-semibold text-[var(--color-noxe-ink)] outline-none focus:outline-none focus:ring-0 placeholder:text-[var(--color-noxe-muted)]"
            />
          </div>
        </div>
        <div className="mt-4 min-h-0 flex-1">
          <Editor className="h-full min-h-0" />
        </div>
      </section>
      <NoteMetaPanel
        noteId={noteId}
        body={buffer?.body ?? ""}
        updated={buffer?.loadedMtime ?? note?.mtime}
        created={typeof buffer?.frontmatter.created === "string" ? buffer.frontmatter.created : undefined}
        onOpenNote={openNote}
      />
      <ChatPanel noteId={noteId} />
    </main>
  );
}

function fixtureBody(note: { title: string; body?: unknown }): string {
  return typeof note.body === "string" ? note.body : `# ${note.title}\n`;
}
