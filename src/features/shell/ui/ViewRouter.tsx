import { useEffect } from "react";

import { HomeView } from "@/features/home/ui/HomeView";
import { NoteView } from "@/features/note-view/ui/NoteView";

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

