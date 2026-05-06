import { useEffect } from "react";

import { EditorPreviewSplit } from "@/features/editor/ui/EditorPreviewSplit";
import { useAutoSave } from "@/features/editor/hooks/useAutoSave";
import { useExternalReconciler } from "@/features/editor/hooks/useExternalReconciler";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { HomeView } from "@/features/home/ui/HomeView";
import { client } from "@/shared/ipc/client";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { EmptyVault } from "./EmptyVault";

export function ViewRouter() {
  const vaultPath = useVaultStore((state) => state.path);
  const notes = useVaultStore((state) => state.notes);
  const view = useShellStore((state) => state.view);
  const drawer = useShellStore((state) => state.drawer);
  const navigate = useShellStore((state) => state.navigate);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && view.kind === "note" && drawer === null) {
        event.preventDefault();
        navigate({ kind: "home" });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawer, navigate, view.kind]);

  if (!vaultPath) {
    return <EmptyVault />;
  }

  if (view.kind === "note") {
    const note = notes.find((candidate) => candidate.id === view.id);
    if (!note && notes.length > 0) {
      navigate({ kind: "home" });
      return <HomeView />;
    }
    return <NoteView title={note?.title ?? "Untitled"} noteId={view.id} />;
  }

  return <HomeView />;
}

function fixtureBody(note: { title: string; body?: unknown }): string {
  return typeof note.body === "string" ? note.body : `# ${note.title}\n`;
}

function NoteView({ noteId, title }: { noteId: string; title: string }) {
  const note = useVaultStore((state) => state.notes.find((candidate) => candidate.id === noteId));
  const openBuffer = useEditorStore((state) => state.openBuffer);
  useAutoSave();
  useExternalReconciler();

  useEffect(() => {
    if (!note) {
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
  }, [note, noteId, openBuffer]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden p-10" data-testid="note-view">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Note</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <div className="mt-4 min-h-0 flex-1">
        <EditorPreviewSplit />
      </div>
    </main>
  );
}
