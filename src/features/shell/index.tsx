import { useEffect } from "react";
import { toast } from "sonner";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useShortcuts } from "@/features/shell/hooks/useShortcuts";
import { startMenuActionListener, stopMenuActionListener } from "@/features/shell/menu/menuActions";
import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { GenerateNoteModal } from "@/features/ai/ui/GenerateNoteModal";
import { BulkActionsBar } from "@/features/folder-ops/ui/BulkActionsBar";
import { CommandPalette } from "@/features/shell/ui/CommandPalette";
import { EmptyVault } from "@/features/shell/ui/EmptyVault";
import { HelpModal } from "@/features/shell/ui/HelpModal";
import { Toaster } from "@/features/shell/ui/Toaster";
import { TriageBody } from "@/features/shell/ui/triage/TriageBody";
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
    const init = async () => {
      // Try to auto-open the most recent vault
      const state = useVaultStore.getState();
      if (!state.path) {
        try {
          const recent = await client.vault.recent();
          if (recent.length > 0) {
            await useVaultStore.getState().openVault(recent[0].path);
          }
        } catch { /* no recent vaults — show EmptyVault */ }
      }

      await loadNotes();

      const current = useVaultStore.getState();
      if (current.path && current.notes.length === 0) {
        const result = await client.vault.scaffoldIfNeeded();
        if (result.created) {
          toast.success("Welcome to Cork — example notes added");
          await loadNotes();
        }
      }

      if (useVaultStore.getState().path) {
        await loadVaultSettings();
      }
      await Promise.all([startWatcherIntegration(), startIndexIntegration()]);
    };
    void init().catch(() => undefined);
  }, [loadNotes, loadVaultSettings, startIndexIntegration, startWatcherIntegration]);

  if (!vaultPath) {
    return (
      <div data-testid="shell" className="h-full bg-[var(--color-cork-bg)]">
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
    <div
      data-testid="shell"
      className="relative flex h-full overflow-hidden bg-[var(--color-cork-bg)]"
    >
      <TriageBody />
      <BulkActionsBar folders={toFolders(notes)} onDone={loadNotes} />
      <CommandPalette />
      <GenerateNoteModal />
      <HelpModal />
      <SettingsPanel />
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
