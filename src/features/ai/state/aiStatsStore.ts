import { create } from "zustand";

import { stats as fetchStats, telemetryClear, cacheClear } from "../services/skillsClient";
import type { AiStats } from "@/shared/ipc/IpcContract";

interface AiStatsState {
  stats: AiStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearTelemetry: () => Promise<void>;
  clearCache: (skillId?: string) => Promise<void>;
}

const EMPTY_STATS: AiStats = {
  callsTotal: 0,
  cacheHitRate: 0,
  tokensIn: 0,
  tokensOut: 0,
  bySkill: [],
  cacheRows: 0,
  cacheBytes: 0,
};

export const useAiStatsStore = create<AiStatsState>((set, get) => ({
  stats: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const next = await fetchStats();
      set({ stats: next, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ stats: EMPTY_STATS, loading: false, error: message });
    }
  },
  clearTelemetry: async () => {
    await telemetryClear();
    await get().refresh();
  },
  clearCache: async (skillId?: string) => {
    await cacheClear(skillId);
    await get().refresh();
  },
}));
