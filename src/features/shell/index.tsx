import { useEffect } from "react";
import { toast } from "sonner";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useShortcuts } from "@/features/shell/hooks/useShortcuts";
import { startMenuActionListener, stopMenuActionListener } from "@/features/shell/menu/menuActions";
import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { GenerateNoteModal } from "@/features/ai/ui/GenerateNoteModal";
import { BulkActionsBar } from "@/features/folder-ops/ui/BulkActionsBar";
import { CommandPalette } from "@/features/shell/ui/CommandPalette";
import { DrawerHost } from "@/features/shell/ui/DrawerHost";
import { EmptyVault } from "@/features/shell/ui/EmptyVault";
import { HelpModal } from "@/features/shell/ui/HelpModal";
import { Rail } from "@/features/shell/ui/Rail";
import { Toaster } from "@/features/shell/ui/Toaster";
import { TopBar } from "@/features/shell/ui/TopBar";
import { ViewRouter } from "@/features/shell/ui/ViewRouter";
import { TriageBody } from "@/features/shell/ui/triage/TriageBody";
import { useViewportWidth } from "@/features/shell/hooks/useViewportWidth";
import { SettingsPanel } from "@/features/settings/ui/SettingsPanel";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

export function Shell() {
  useShortcuts();
  const vaultPath = useVaultStore((state) => state.path);
  const notes = useVaultStore((state) => state.notes);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const startWatcherIntegration = useVaultStore((state) => state.startWatcherIntegration);
  const startIndexIntegration = useIndexStore((state) => state.startIndexIntegration);
  const loadVaultSettings = useAppSettingsStore((state) => state.loadVaultSettings);

  useEffect(() => {
    startMenuActionListener();
    return () => {
      void stopMenuActionListener();
    };
  }, []);

  useEffect(() => {
    void loadNotes()
      .then(async () => {
        const state = useVaultStore.getState();
        if (state.path && state.notes.length === 0) {
          const result = await client.vault.scaffoldIfNeeded();
          if (result.created) {
            toast.success("Welcome to Noxe — example notes added");
            await loadNotes();
          }
        }
      })
      .then(() => (useVaultStore.getState().path ? loadVaultSettings() : undefined))
      .then(() => Promise.all([startWatcherIntegration(), startIndexIntegration()]))
      .catch(() => undefined);
  }, [loadNotes, loadVaultSettings, startIndexIntegration, startWatcherIntegration]);

  if (!vaultPath) {
    return (
      <div data-testid="shell" className="h-full bg-[var(--color-noxe-bg)]">
        <EmptyVault />
        <CommandPalette />
        <GenerateNoteModal />
        <HelpModal />
        <SettingsPanel />
        <Toaster />
      </div>
    );
  }

  return (
    <div data-testid="shell" className="relative flex h-full overflow-hidden bg-[var(--color-noxe-bg)]">
      <div className="h-full w-14 shrink-0">
        <Rail />
      </div>
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <TopBar />
        <ShellBody />
      </div>
      <BulkActionsBar folders={toFolders(notes)} onDone={loadNotes} />
      <CommandPalette />
      <GenerateNoteModal />
      <HelpModal />
      <SettingsPanel />
      <Toaster />
    </div>
  );
}

const TRIAGE_MIN_WIDTH = 1100;

function ShellBody() {
  const layoutMode = useAppSettingsStore((state) => state.settings.layout.mode);
  const width = useViewportWidth();
  const effectiveMode = width < TRIAGE_MIN_WIDTH ? "focus" : layoutMode;
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden" data-shell-mode={effectiveMode}>
      {effectiveMode === "triage" ? (
        <TriageBody />
      ) : (
        <>
          <DrawerHost />
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <ViewRouter />
          </div>
        </>
      )}
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
