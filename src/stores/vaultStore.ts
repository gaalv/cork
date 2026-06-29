/**
 * Vault store — manages the currently open vault, note list, and lifecycle.
 *
 * Responsible for opening/closing vaults, loading the note list from
 * the backend, and starting the filesystem watcher integration.
 *
 * Note mutations follow the optimistic pattern:
 * 1. Snapshot previous state
 * 2. Apply optimistic update synchronously
 * 3. Persist via IPC async
 * 4. On error: rollback to snapshot and re-throw
 *
 * @see F10 — Daily Notes & Multi-Vault spec
 * @see CONVENTIONS.md — Optimistic Mutations
 */

import { create } from "zustand";

import { client } from "@/ipc/client";
import type { NoteEntry } from "@/ipc/types";

type VaultState = {
  path: string | null;
  notes: NoteEntry[];
  isLoading: boolean;
  error: string | null;
  openVault: (path?: string) => Promise<void>;
  loadNotes: () => Promise<void>;
  startWatcherIntegration: () => Promise<void>;

  // — Mutations (optimistic → persist → rollback on error) —
  renameNote: (oldPath: string, newName: string) => Promise<void>;
  trashNote: (path: string) => Promise<void>;
  moveNote: (notePath: string, destFolder: string) => Promise<void>;
};

export const useVaultStore = create<VaultState>((set, get) => ({
  path: null,
  notes: [],
  isLoading: false,
  error: null,

  openVault: async (path) => {
    set({ isLoading: true });
    try {
      const result = await client.vault.open(path);
      const vaultPath = (result as { path: string }).path;
      set({ path: vaultPath });
      await get().loadNotes();
    } catch (err) {
      // If vault.open fails (e.g. user cancelled dialog), just stop loading
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("cancelled")) {
        throw err;
      }
    } finally {
      set({ isLoading: false });
    }
  },

  loadNotes: async () => {
    try {
      const result = await client.vault.list();
      set({ notes: result as NoteEntry[] });
    } catch {
      // vault may not be open yet — keep current state
    }
  },

  startWatcherIntegration: async () => {
    try {
      await client.vault.watcherStart();

      // Subscribe to file changes to refresh the note list
      void client.events.on("vault:fileChanged", () => {
        void get().loadNotes();
      });
    } catch {
      // watcher may already be running or vault not open
    }
  },

  // — Rename: optimistic title update → persist → rollback —
  renameNote: async (oldPath, newName) => {
    const prevNotes = get().notes;

    // 1. Optimistic: update title in list
    set((state) => ({
      notes: state.notes.map((n) => (n.path === oldPath ? { ...n, title: newName } : n)),
    }));

    // 2. Persist
    try {
      await client.notes.rename({ oldPath, newName });
      // Reload to get the updated path/metadata from backend
      await get().loadNotes();
    } catch (err) {
      // 3. Rollback
      set({ notes: prevNotes });
      throw err;
    }
  },

  // — Trash: optimistic remove → persist → rollback —
  trashNote: async (notePath) => {
    const prevNotes = get().notes;

    // 1. Optimistic: remove from list
    set((state) => ({
      notes: state.notes.filter((n) => n.path !== notePath),
    }));

    // 2. Persist
    try {
      await client.notes.trash(notePath);
    } catch (err) {
      // 3. Rollback
      set({ notes: prevNotes });
      throw err;
    }
  },

  // — Move: optimistic folder update → persist → rollback —
  moveNote: async (notePath, destFolder) => {
    const prevNotes = get().notes;

    // 1. Optimistic: update folder in list
    set((state) => ({
      notes: state.notes.map((n) => (n.path === notePath ? { ...n, folder: destFolder } : n)),
    }));

    // 2. Persist
    try {
      await client.notes.move({ notePath, destFolder });
    } catch (err) {
      // 3. Rollback
      set({ notes: prevNotes });
      throw err;
    }
  },
}));
