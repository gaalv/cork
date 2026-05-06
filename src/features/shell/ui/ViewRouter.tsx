import { useEffect } from "react";

import { useBulkSelection } from "@/features/folder-ops/hooks/useBulkSelection";
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

function HomeView() {
  const notes = useVaultStore((state) => state.notes);
  const navigate = useShellStore((state) => state.navigate);
  const bulkSelection = useBulkSelection(notes.map((note) => note.path));

  return (
    <main className="flex-1 overflow-y-auto p-10" data-testid="home-view">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Home</p>
      <h1 className="mt-1 text-2xl font-semibold">Bem-vindo de volta 👋</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={(event) => {
              if (!bulkSelection.handleClick(event, note.path)) {
                navigate({ kind: "note", id: note.id });
              }
            }}
            className={`rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] p-4 text-left hover:border-[var(--color-noxe-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none ${bulkSelection.isSelected(note.path) ? "border-[var(--color-noxe-border-strong)] bg-[var(--color-noxe-accent-soft)]" : ""}`}
          >
            <span className="font-medium">{note.title}</span>
            <span className="mt-1 block text-[12px] text-[var(--color-noxe-muted)]">{note.folder || "Vault"}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function NoteView({ noteId, title }: { noteId: string; title: string }) {
  return (
    <main className="flex-1 overflow-y-auto p-10" data-testid="note-view">
      <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Note</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-[var(--color-noxe-muted)]">Note ID: {noteId}</p>
    </main>
  );
}
