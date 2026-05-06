import { useEffect } from "react";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useShortcuts } from "@/features/shell/hooks/useShortcuts";
import { BulkActionsBar } from "@/features/folder-ops/ui/BulkActionsBar";
import { CommandPalette } from "@/features/shell/ui/CommandPalette";
import { DrawerHost } from "@/features/shell/ui/DrawerHost";
import { EmptyVault } from "@/features/shell/ui/EmptyVault";
import { HelpModal } from "@/features/shell/ui/HelpModal";
import { Rail } from "@/features/shell/ui/Rail";
import { Toaster } from "@/features/shell/ui/Toaster";
import { TopBar } from "@/features/shell/ui/TopBar";
import { ViewRouter } from "@/features/shell/ui/ViewRouter";
import { useVaultStore } from "@/features/vault/state/vaultStore";

export function Shell() {
  useShortcuts();
  const vaultPath = useVaultStore((state) => state.path);
  const notes = useVaultStore((state) => state.notes);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const startWatcherIntegration = useVaultStore((state) => state.startWatcherIntegration);
  const startIndexIntegration = useIndexStore((state) => state.startIndexIntegration);

  useEffect(() => {
    void loadNotes()
      .then(() => Promise.all([startWatcherIntegration(), startIndexIntegration()]))
      .catch(() => undefined);
  }, [loadNotes, startIndexIntegration, startWatcherIntegration]);

  if (!vaultPath) {
    return (
      <div data-testid="shell" className="h-full bg-[var(--color-noxe-bg)]">
        <EmptyVault />
        <CommandPalette />
        <HelpModal />
        <Toaster />
      </div>
    );
  }

  return (
    <div data-testid="shell" className="relative grid h-full grid-cols-[56px_1fr] bg-[var(--color-noxe-bg)]">
      <Rail />
      <div className="relative flex h-full min-w-0 flex-col">
        <TopBar />
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <DrawerHost />
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <ViewRouter />
          </div>
        </div>
      </div>
      <BulkActionsBar folders={toFolders(notes)} onDone={loadNotes} />
      <CommandPalette />
      <HelpModal />
      <Toaster />
    </div>
  );
}

function toFolders(notes: Array<{ folder: string }>) {
  const counts = new Map<string, number>();
  for (const note of notes) {
    if (note.folder) {
      counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([id, count]) => ({ id, name: id, count }));
}
