import { beforeEach, describe, expect, it, vi } from "vitest";

const { skillsClientMock } = vi.hoisted(() => ({
  skillsClientMock: {
    stats: vi.fn(),
    telemetryClear: vi.fn(),
    cacheClear: vi.fn(),
  },
}));

vi.mock("../services/skillsClient", () => skillsClientMock);

import { useAiStatsStore } from "./aiStatsStore";

const SAMPLE = {
  callsTotal: 4,
  cacheHitRate: 0.5,
  tokensIn: 1000,
  tokensOut: 500,
  bySkill: [{ skillId: "summarize", calls: 4, tokens: 1500 }],
  cacheRows: 2,
  cacheBytes: 4096,
};

beforeEach(() => {
  Object.values(skillsClientMock).forEach((fn) => fn.mockReset());
  useAiStatsStore.setState({ stats: null, loading: false, error: null });
});

describe("useAiStatsStore", () => {
  it("refresh populates stats", async () => {
    skillsClientMock.stats.mockResolvedValue(SAMPLE);
    await useAiStatsStore.getState().refresh();
    expect(useAiStatsStore.getState().stats?.callsTotal).toBe(4);
    expect(useAiStatsStore.getState().loading).toBe(false);
    expect(useAiStatsStore.getState().error).toBeNull();
  });

  it("refresh records errors and falls back to empty stats", async () => {
    skillsClientMock.stats.mockRejectedValue(new Error("bridge down"));
    await useAiStatsStore.getState().refresh();
    expect(useAiStatsStore.getState().error).toContain("bridge down");
    expect(useAiStatsStore.getState().stats?.callsTotal).toBe(0);
  });

  it("clearTelemetry calls API then refreshes", async () => {
    skillsClientMock.telemetryClear.mockResolvedValue(3);
    skillsClientMock.stats.mockResolvedValue(SAMPLE);
    await useAiStatsStore.getState().clearTelemetry();
    expect(skillsClientMock.telemetryClear).toHaveBeenCalled();
    expect(skillsClientMock.stats).toHaveBeenCalled();
  });

  it("clearCache forwards optional skillId then refreshes", async () => {
    skillsClientMock.cacheClear.mockResolvedValue(1);
    skillsClientMock.stats.mockResolvedValue(SAMPLE);
    await useAiStatsStore.getState().clearCache("summarize");
    expect(skillsClientMock.cacheClear).toHaveBeenCalledWith("summarize");
  });
});
