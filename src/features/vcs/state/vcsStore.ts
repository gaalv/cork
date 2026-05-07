import { create } from "zustand";

import { vcsClient } from "@/features/vcs/services/vcsClient";

import type { VcsStatus } from "@/shared/ipc/types";

type VcsStore = {
  status: VcsStatus | null;
  loadStatus: () => Promise<void>;
};

export const useVcsStore = create<VcsStore>((set) => ({
  status: null,

  async loadStatus() {
    try {
      const status = await vcsClient.status();
      set({ status });
    } catch {
      set({ status: null });
    }
  },
}));
