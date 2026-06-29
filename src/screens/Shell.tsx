import { useEffect } from "react";
import { toast } from "sonner";

import { useIndexStore } from "@/stores/indexStore";
import { useShortcuts } from "@/hooks/useShortcuts";
import { startMenuActionListener, stopMenuActionListener } from "@/services/menuActions";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { GenerateNoteModal } from "@/components/modals/GenerateNoteModal";
import { BulkActionsBar } from "@/components/folders/BulkActionsBar";
import { CommandPalette } from "@/components/modals/CommandPalette";
import { EmptyVault } from "@/screens/EmptyVault";
import { HelpModal } from "@/components/modals/HelpModal";
import { Toaster } from "@/components/ui/Toaster";
import { TriageBody } from "@/screens/TriageBody";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useVaultStore } from "@/stores/vaultStore";
import { client } from "@/ipc/client";

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
        } catch {
          /* no recent vaults — show EmptyVault */
        }
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
