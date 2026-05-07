import { create } from "zustand";

import { client } from "@/shared/ipc/client";
import type { RemoteInfo, SyncStatus, VcsStatus } from "@/shared/ipc/types";

type SyncState = {
  status: VcsStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  enable: (url?: string) => Promise<RemoteInfo>;
  disable: () => Promise<RemoteInfo>;
  syncNow: () => Promise<RemoteInfo>;
};

let pollHandle: ReturnType<typeof setInterval> | null = null;

export const useSyncStore = create<SyncState>((set, get) => ({
  status: null,
  loading: false,
  error: null,
  refresh: async () => {
    try {
      const status = await client.vcs.status();
      set({ status, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },
  enable: async (url?: string) => {
    set({ loading: true, error: null });
    try {
      const remote = await client.vcs.remoteEnable(url);
      await get().refresh();
      return remote;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  disable: async () => {
    set({ loading: true, error: null });
    try {
      const remote = await client.vcs.remoteDisable();
      await get().refresh();
      return remote;
    } finally {
      set({ loading: false });
    }
  },
  syncNow: async () => {
    set({ loading: true, error: null });
    try {
      const remote = await client.vcs.remoteSyncNow();
      await get().refresh();
      return remote;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },
}));

export function startSyncPolling(intervalMs = 5000): void {
  if (pollHandle) return;
  void useSyncStore.getState().refresh();
  pollHandle = setInterval(() => {
    void useSyncStore.getState().refresh();
  }, intervalMs);
}

export function stopSyncPolling(): void {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

export function selectRemote(state: SyncState): RemoteInfo | null {
  return state.status?.remote ?? null;
}

export function selectSyncStatus(state: SyncState): SyncStatus | null {
  return state.status?.remote?.syncStatus ?? null;
}
