import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import type { RecentVault } from "@/shared/ipc/types";

type RecentVaultsStore = {
  vaults: RecentVault[];
  isLoading: boolean;
  error: string | null;
  loadRecent: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
  reset: () => void;
};

export const useRecentVaultsStore = create<RecentVaultsStore>((set, get) => ({
  vaults: [],
  isLoading: false,
  error: null,

  async loadRecent() {
    set({ isLoading: true, error: null });
    try {
      const vaults = await client.vault.recent();
      set({ vaults, isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false, error: errorMessage(error) });
    }
  },

  async removeRecent(path) {
    const previous = get().vaults;
    set({ vaults: previous.filter((vault) => vault.path !== path), error: null });
    try {
      await client.vault.removeRecent(path);
    } catch (error) {
      set({ vaults: previous, error: errorMessage(error) });
    }
  },

  reset() {
    set({ vaults: [], isLoading: false, error: null });
  },
}));

if (
  typeof window !== "undefined" &&
  (import.meta.env.MODE !== "production" || window.location.hostname === "localhost")
) {
  window.__noxe_test_setRecentVaults = (vaults) => {
    useRecentVaultsStore.setState({ vaults, isLoading: false, error: null });
  };
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
  return "Unknown recent vaults error";
}
