import { create } from "zustand";

import { client } from "@/ipc/client";
import type { DeployKeyInfo, RemoteInfo, SyncStatus, VcsStatus } from "@/ipc/types";

type SyncState = {
  status: VcsStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  enable: (input?: { url?: string; token?: string }) => Promise<RemoteInfo>;
  disable: () => Promise<RemoteInfo>;
  syncNow: () => Promise<RemoteInfo>;
  updateToken: (token: string) => Promise<RemoteInfo>;
  generateDeployKey: () => Promise<DeployKeyInfo>;
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
  enable: async (input?: { url?: string; token?: string }) => {
    set({ loading: true, error: null });
    try {
      const remote = await client.vcs.remoteEnable(input);
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
  updateToken: async (token: string) => {
    set({ loading: true, error: null });
    try {
      const remote = await client.vcs.updateToken(token);
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
  generateDeployKey: async () => {
    set({ loading: true, error: null });
    try {
      return await client.vcs.generateDeployKey();
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
