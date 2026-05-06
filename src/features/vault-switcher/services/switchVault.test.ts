import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useIndexStore } from "@/features/index/state/indexStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { useRecentVaultsStore } from "../state/recentVaultsStore";
import { switchVault } from "./switchVault";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    vault: {
      current: vi.fn(),
      close: vi.fn(),
      open: vi.fn(),
      list: vi.fn(),
      watcherStart: vi.fn(),
      watcherStop: vi.fn(),
      recent: vi.fn(),
      removeRecent: vi.fn(),
      settings: vi.fn(),
    },
    events: {
      on: vi.fn(),
    },
    index: {
      status: vi.fn(),
    },
    notes: {
      recent: vi.fn(),
    },
    tags: {
      list: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

describe("switchVault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientMock.vault.current.mockResolvedValue({ path: "/vault-a" });
    clientMock.vault.close.mockResolvedValue(undefined);
    clientMock.vault.open.mockResolvedValue({ path: "/vault-b" });
    clientMock.vault.list.mockResolvedValue([]);
    clientMock.vault.watcherStart.mockResolvedValue(undefined);
    clientMock.vault.watcherStop.mockResolvedValue(undefined);
    clientMock.vault.recent.mockResolvedValue([]);
    clientMock.vault.settings.mockResolvedValue({});
    clientMock.events.on.mockResolvedValue(vi.fn());
    clientMock.index.status.mockResolvedValue({ ready: true, vaultPath: "/vault-b", indexedNotes: 0, pendingJobs: 0 });
    clientMock.notes.recent.mockResolvedValue([]);
    clientMock.tags.list.mockResolvedValue([]);
    useEditorStore.setState({ activeNoteId: null, buffers: new Map(), flushAll: vi.fn().mockResolvedValue(undefined) });
    useVaultStore.setState({ path: "/vault-a", notes: [], isLoading: false, error: null });
    useShellStore.getState().reset();
    useRecentVaultsStore.setState({ vaults: [], isLoading: false, error: null });
    useIndexStore.getState().stopIndexIntegration();
  });

  it("flushes, closes, opens, and navigates home", async () => {
    await switchVault({ path: "/vault-b" });

    expect(useEditorStore.getState().flushAll).toHaveBeenCalled();
    expect(clientMock.vault.close).toHaveBeenCalled();
    expect(clientMock.vault.open).toHaveBeenCalledWith("/vault-b");
    expect(useVaultStore.getState().path).toBe("/vault-b");
    expect(useShellStore.getState().view).toEqual({ kind: "home" });
  });

  it("restores the previous vault when opening the next one fails", async () => {
    clientMock.vault.open.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ path: "/vault-a" });

    await expect(switchVault({ path: "/vault-b" })).rejects.toThrow("boom");

    expect(clientMock.vault.open).toHaveBeenNthCalledWith(1, "/vault-b");
    expect(clientMock.vault.open).toHaveBeenNthCalledWith(2, "/vault-a");
    expect(useVaultStore.getState().path).toBe("/vault-a");
  });
});
