import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecentVaultsStore } from "./recentVaultsStore";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    vault: {
      recent: vi.fn(),
      removeRecent: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

describe("recentVaultsStore", () => {
  beforeEach(() => {
    clientMock.vault.recent.mockReset();
    clientMock.vault.removeRecent.mockReset();
    clientMock.vault.removeRecent.mockResolvedValue(undefined);
    useRecentVaultsStore.setState({ vaults: [], isLoading: false, error: null });
  });

  it("loads persisted recent vaults", async () => {
    clientMock.vault.recent.mockResolvedValue([
      { path: "/vault-a", name: "vault-a", missing: false },
      { path: "/vault-b", name: "vault-b", missing: true },
    ]);

    await useRecentVaultsStore.getState().loadRecent();

    expect(clientMock.vault.recent).toHaveBeenCalled();
    expect(useRecentVaultsStore.getState().vaults).toEqual([
      { path: "/vault-a", name: "vault-a", missing: false },
      { path: "/vault-b", name: "vault-b", missing: true },
    ]);
    expect(useRecentVaultsStore.getState().isLoading).toBe(false);
  });

  it("removes a persisted recent vault optimistically", async () => {
    useRecentVaultsStore.setState({
      vaults: [
        { path: "/vault-a", name: "vault-a", missing: false },
        { path: "/vault-b", name: "vault-b", missing: false },
      ],
    });

    await useRecentVaultsStore.getState().removeRecent("/vault-a");

    expect(clientMock.vault.removeRecent).toHaveBeenCalledWith("/vault-a");
    expect(useRecentVaultsStore.getState().vaults).toEqual([{ path: "/vault-b", name: "vault-b", missing: false }]);
  });
});
