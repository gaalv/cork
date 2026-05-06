import { useEditorStore } from "@/features/editor/state/editorStore";
import { useIndexStore } from "@/features/index/state/indexStore";
import { useNoteViewStore } from "@/features/note-view/state/noteViewStore";
import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { client } from "@/shared/ipc/client";

import { useRecentVaultsStore } from "../state/recentVaultsStore";

type SwitchVaultOptions = {
  path?: string;
};

export async function switchVault(options: SwitchVaultOptions = {}): Promise<void> {
  const previous = await client.vault.current();
  await useEditorStore.getState().flushAll();
  try {
    await client.vault.close();
    resetStoresForSwitch();
    const opened = await client.vault.open(options.path);
    await useAppSettingsStore.getState().loadVaultSettings();
    const notes = await client.vault.list();
    useVaultStore.setState({ path: opened.path, notes, isLoading: false, error: null });
    await Promise.all([
      useVaultStore.getState().startWatcherIntegration(),
      useIndexStore.getState().startIndexIntegration(),
      useRecentVaultsStore.getState().loadRecent(),
    ]);
    useShellStore.getState().navigate({ kind: "home" });
  } catch (error) {
    await restorePreviousVault(previous?.path ?? null);
    throw error;
  }
}

function resetStoresForSwitch() {
  useVaultStore.setState({ path: null, notes: [], isLoading: false, error: null });
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
  useNoteViewStore.getState().reset();
  useDrawersStore.getState().reset();
  useIndexStore.getState().stopIndexIntegration();
  useShellStore.getState().reset();
}

async function restorePreviousVault(previousPath: string | null) {
  resetStoresForSwitch();
  if (!previousPath) {
    return;
  }
  try {
    const opened = await client.vault.open(previousPath);
    await useAppSettingsStore.getState().loadVaultSettings();
    const notes = await client.vault.list();
    useVaultStore.setState({ path: opened.path, notes, isLoading: false, error: null });
    await Promise.all([
      useVaultStore.getState().startWatcherIntegration(),
      useIndexStore.getState().startIndexIntegration(),
      useRecentVaultsStore.getState().loadRecent(),
    ]);
  } catch (restoreError) {
    useVaultStore.setState({ path: null, notes: [], isLoading: false, error: errorMessage(restoreError) });
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unable to restore previous vault";
}
