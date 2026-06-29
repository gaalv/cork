import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useDragRegion } from "@/hooks/useDragRegion";
import { Eye, NotePencil, Pencil, SidebarSimple, Trash } from "@phosphor-icons/react";

import { client } from "@/ipc/client";
import { Editor } from "@/components/editor/Editor";
import { useEditorStore } from "@/stores/editorStore";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { Inspector } from "@/components/editor/inspector/Inspector";
import { MarkdownPreview } from "@/components/editor/MarkdownPreview";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";

export function EditorPane({
  inspectorOpen,
  onToggleInspector,
}: {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  const view = useShellStore((s) => s.view);
  const notes = useVaultStore((s) => s.notes);
  const [preview, setPreview] = useState(false);

  const noteId = view.kind === "note" ? view.id : null;
  useEffect(() => {
    setPreview(false);
  }, [noteId]);

  if (view.kind !== "note") {
    return <EmptyEditor />;
  }

  const note = notes.find((n) => n.id === view.id);
  if (!note) {
    return (
      <main className="flex h-full items-center justify-center bg-[var(--color-cork-panel)] text-[14px] text-[var(--color-cork-muted)]">
        Note not found
      </main>
    );
  }

  return (
    <main className="flex h-full flex-col ">
      <EditorHeader
        note={note}
        inspectorOpen={inspectorOpen}
        onToggleInspector={onToggleInspector}
        preview={preview}
        onTogglePreview={() => setPreview((v) => !v)}
      />
      {!preview && <EditorToolbar />}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {preview ? <MarkdownPreview /> : <Editor noteId={note.id} path={note.path} />}
      </div>
    </main>
  );
}

export function InspectorPane() {
  const view = useShellStore((s) => s.view);
  const notes = useVaultStore((s) => s.notes);

  if (view.kind !== "note") return null;
  const note = notes.find((n) => n.id === view.id);
  if (!note) return null;

  return <Inspector noteMtime={note.mtime} />;
}

function EditorHeader({
  note,
  inspectorOpen,
  onToggleInspector,
  preview,
  onTogglePreview,
}: {
  note: { id: string; path: string; folder: string; title: string };
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  preview: boolean;
  onTogglePreview: () => void;
}) {
  const dragRef = useDragRegion<HTMLDivElement>();
  const trashNote = useVaultStore((s) => s.trashNote);
  const loadNotes = useVaultStore((s) => s.loadNotes);
  const goHome = useShellStore((s) => s.goHome);
  const navigate = useShellStore((s) => s.navigate);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingTitle, setEditingTitle] = useState(note.title);

  useEffect(() => {
    setEditingTitle(note.title);
  }, [note.title]);

  const handleTrash = async () => {
    try {
      await trashNote(note.path);
      goHome();
      toast.success("Note moved to trash");
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const commitRename = async () => {
    const trimmed = editingTitle.trim();
    const newName = trimmed || "Untitled";
    if (newName === note.title) {
      setEditingTitle(newName);
      return;
    }
    try {
      const renamed = await client.notes.rename({ oldPath: note.path, newName });
      useEditorStore.getState().setPath(renamed.path);
      await loadNotes();
      const updated = useVaultStore.getState().notes.find((n) => n.path === renamed.path);
      if (updated) {
        navigate({ kind: "note", id: updated.id });
      }
    } catch {
      setEditingTitle(note.title);
      toast.error("Failed to rename note");
    }
  };

  return (
    <div
      ref={dragRef}
      className="flex h-12 items-center justify-between border-b border-[var(--color-cork-border)] px-5 text-sm text-[var(--color-cork-muted)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0">{note.folder || "Inbox"}</span>
        <span className="shrink-0">/</span>
        <input
          ref={inputRef}
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onBlur={() => void commitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
            }
            if (e.key === "Escape") {
              setEditingTitle(note.title);
              inputRef.current?.blur();
            }
          }}
          className="min-w-0 flex-1 truncate border-none bg-transparent text-[var(--color-cork-ink)] outline-none"
          spellCheck={false}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => {
            if (preview) onTogglePreview();
          }}
          title="Edit"
          className={`rounded-md p-1.5 ${
            !preview
              ? "bg-[var(--color-cork-panel-2)] text-[var(--color-cork-ink)]"
              : "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          }`}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => {
            if (!preview) onTogglePreview();
          }}
          title="Preview"
          className={`rounded-md p-1.5 ${
            preview
              ? "bg-[var(--color-cork-panel-2)] text-[var(--color-cork-ink)]"
              : "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          }`}
        >
          <Eye size={14} />
        </button>
        <button
          onClick={() => void handleTrash()}
          title="Move to trash"
          className="rounded-md p-1.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-danger-tint)] hover:text-[var(--color-cork-danger)]"
        >
          <Trash size={14} />
        </button>
        <div className="mx-1 h-4 w-px bg-[var(--color-cork-border)]" />
        <button
          onClick={onToggleInspector}
          title="Inspector"
          className={`rounded-md p-1.5 ${
            inspectorOpen
              ? "bg-[var(--color-cork-accent-soft)] text-[var(--color-cork-accent)]"
              : "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
          }`}
        >
          <SidebarSimple size={14} />
        </button>
      </div>
    </div>
  );
}

function EmptyEditor() {
  const dragRef = useDragRegion<HTMLDivElement>();

  return (
    <main className="relative flex h-full flex-col items-center justify-center gap-2  text-[var(--color-cork-muted)]">
      <div ref={dragRef} className="absolute inset-x-0 top-0 h-12" />
      <NotePencil size={32} className="text-[var(--color-cork-subtle)]" />
      <span className="text-[14px]">Select a note to get started</span>
      <span className="text-[12px] text-[var(--color-cork-subtle)]">
        or press{" "}
        <kbd className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-kbd)] px-1 text-[10px]">
          ⌘ N
        </kbd>{" "}
        to create one
      </span>
    </main>
  );
}
