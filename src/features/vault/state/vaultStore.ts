import { create } from "zustand";

import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { client } from "@/shared/ipc/client";

import type { NoteEntry, VaultFileChangedEvent } from "@/shared/ipc/types";

type Unlisten = () => void;

type VaultStore = {
  path: string | null;
  notes: NoteEntry[];
  isLoading: boolean;
  error: string | null;
  loadNotes: () => Promise<void>;
  openVault: () => Promise<void>;
  startWatcherIntegration: () => Promise<void>;
  stopWatcherIntegration: () => Promise<void>;
};

let watcherUnlisten: Unlisten | null = null;

export const useVaultStore = create<VaultStore>((set, get) => ({
  path: null,
  notes: [],
  isLoading: false,
  error: null,

  async loadNotes() {
    set({ isLoading: true, error: null });
    try {
      const current = await client.vault.current();
      if (!current) {
        set({ path: null, notes: [], isLoading: false });
        return;
      }
      const notes = await client.vault.list();
      set({ path: current.path, notes, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: errorMessage(error) });
    }
  },

  async openVault() {
    set({ isLoading: true, error: null });
    try {
      const opened = await client.vault.open();
      await useAppSettingsStore.getState().loadVaultSettings();
      const notes = await client.vault.list();
      set({ path: opened.path, notes, isLoading: false });
      await get().startWatcherIntegration();
    } catch (error) {
      set({ isLoading: false, error: errorMessage(error) });
    }
  },

  async startWatcherIntegration() {
    if (watcherUnlisten) {
      return;
    }
    watcherUnlisten = await client.events.on("vault:fileChanged", (event) => {
      applyFileChanged(event);
      void get().loadNotes();
    });
    await client.vault.watcherStart();
  },

  async stopWatcherIntegration() {
    watcherUnlisten?.();
    watcherUnlisten = null;
    await client.vault.watcherStop();
  },
}));

function applyFileChanged(event: VaultFileChangedEvent) {
  useVaultStore.setState((state) => {
    if (event.kind === "removed") {
      return { notes: state.notes.filter((note) => note.path !== event.path) };
    }

    const index = state.notes.findIndex((note) => note.path === event.path);
    if (index === -1) {
      return state;
    }

    const notes = [...state.notes];
    notes[index] = { ...notes[index], mtime: event.mtime, size: event.size };
    return { notes };
  });
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
  return "Unknown vault error";
}

if (
  typeof window !== "undefined" &&
  (import.meta.env.MODE !== "production" || window.location.hostname === "localhost")
) {
  window.__noxe_test_setVault = (path, notes = []) => {
    useVaultStore.setState({ path, notes, isLoading: false, error: null });
  };
}
