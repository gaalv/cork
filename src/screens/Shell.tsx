import { Suspense, lazy, useEffect } from "react";
import { toast } from "sonner";

import { useIndexStore } from "@/stores/indexStore";
import { useShortcuts } from "@/hooks/useShortcuts";
import { startMenuActionListener, stopMenuActionListener } from "@/services/menuActions";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { GenerateNoteModal } from "@/components/modals/GenerateNoteModal";
import { BulkActionsBar } from "@/components/folders/BulkActionsBar";
import { CommandPalette } from "@/components/modals/CommandPalette";
import { TemplatePicker } from "@/components/modals/TemplatePicker";
import { WelcomeScreen } from "@/screens/WelcomeScreen";
import { HelpModal } from "@/components/modals/HelpModal";
import { Toaster } from "@/components/ui/Toaster";
import { TriageBody } from "@/screens/TriageBody";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { useVaultStore } from "@/stores/vaultStore";
import { useShellStore } from "@/stores/shellStore";
import { client } from "@/ipc/client";

// Lazy — keeps d3-force out of the main chunk (F46).
const GraphView = lazy(() =>
  import("@/components/modals/GraphView").then((m) => ({ default: m.GraphView })),
);
// Lazy — the calendar is an occasional overlay (F47).
const CalendarOverlay = lazy(() =>
  import("@/components/modals/CalendarOverlay").then((m) => ({ default: m.CalendarOverlay })),
);

export function Shell() {
  useShortcuts();
  const vaultPath = useVaultStore((state) => state.path);
  const graphOpen = useShellStore((state) => state.graphOpen);
  const calendarOpen = useShellStore((state) => state.calendarOpen);
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

  // Auto-open most recent vault on launch (skip WelcomeScreen if user already has one)
  useEffect(() => {
    const autoOpen = async () => {
      if (useVaultStore.getState().path) return;
      try {
        const recent = await client.vault.recent();
        if (recent.length > 0) {
          await useVaultStore.getState().openVault(recent[0].path);
        }
      } catch {
        /* no recent vaults — show WelcomeScreen */
      }
    };
    void autoOpen();
  }, []);

  // Initialize vault services once a vault is open
  useEffect(() => {
    if (!vaultPath) return;

    const init = async () => {
      await loadNotes();

      const current = useVaultStore.getState();
      if (current.notes.length === 0) {
        const result = await client.vault.scaffoldIfNeeded();
        if (result.created) {
          toast.success("Welcome to Cork — example notes added");
          await loadNotes();
        }
      }

      await loadVaultSettings();
      await Promise.all([startWatcherIntegration(), startIndexIntegration()]);
    };
    void init().catch(() => undefined);
  }, [vaultPath, loadNotes, loadVaultSettings, startIndexIntegration, startWatcherIntegration]);

  if (!vaultPath) {
    return (
      <div data-testid="shell" className="h-full bg-[var(--color-cork-bg)]">
        <WelcomeScreen />
        <CommandPalette />
        <GenerateNoteModal />
        <TemplatePicker />
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
      {graphOpen && (
        <Suspense fallback={null}>
          <GraphView />
        </Suspense>
      )}
      {calendarOpen && (
        <Suspense fallback={null}>
          <CalendarOverlay />
        </Suspense>
      )}
      <CommandPalette />
      <GenerateNoteModal />
      <TemplatePicker />
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
