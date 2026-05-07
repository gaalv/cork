import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  cacheClear,
  listSkills,
  reload,
  runSkill,
  stats,
  telemetryClear,
} from "./skillsClient";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    ai: {
      runSkill: vi.fn(),
      cacheClear: vi.fn(),
      skillsReload: vi.fn(),
      skillsList: vi.fn(),
      stats: vi.fn(),
      telemetryClear: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  Object.values(clientMock.ai).forEach((fn) => fn.mockReset());
});

describe("skillsClient", () => {
  it("runSkill forwards skillId and variables", async () => {
    clientMock.ai.runSkill.mockResolvedValue({
      output: "ok",
      cacheHit: false,
      tokensIn: 10,
      tokensOut: 5,
      latencyMs: 100,
      skillId: "summarize",
    });
    const r = await runSkill("summarize", { body: "hello" });
    expect(clientMock.ai.runSkill).toHaveBeenCalledWith("summarize", { body: "hello" });
    expect(r.output).toBe("ok");
  });

  it("cacheClear forwards optional skillId", async () => {
    clientMock.ai.cacheClear.mockResolvedValue(3);
    await cacheClear("summarize");
    expect(clientMock.ai.cacheClear).toHaveBeenCalledWith("summarize");
    await cacheClear();
    expect(clientMock.ai.cacheClear).toHaveBeenCalledWith(undefined);
  });

  it("reload, listSkills, stats, telemetryClear pass through", async () => {
    clientMock.ai.skillsReload.mockResolvedValue(7);
    expect(await reload()).toBe(7);

    clientMock.ai.skillsList.mockResolvedValue([
      { id: "summarize", name: "Summarize", source: "bundled", triggers: [] },
    ]);
    expect((await listSkills())[0].id).toBe("summarize");

    clientMock.ai.stats.mockResolvedValue({
      callsTotal: 0,
      cacheHitRate: 0,
      tokensIn: 0,
      tokensOut: 0,
      bySkill: [],
      cacheRows: 0,
      cacheBytes: 0,
    });
    await stats(123);
    expect(clientMock.ai.stats).toHaveBeenCalledWith(123);

    clientMock.ai.telemetryClear.mockResolvedValue(5);
    expect(await telemetryClear()).toBe(5);
  });
});
