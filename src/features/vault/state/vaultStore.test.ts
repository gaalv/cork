import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "./vaultStore";

import type { IpcEventPayload } from "@/shared/ipc/IpcContract";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    vault: {
      current: vi.fn(),
      list: vi.fn(),
      open: vi.fn(),
      watcherStart: vi.fn(),
      watcherStop: vi.fn(),
    },
    events: {
      on: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

describe("vaultStore", () => {
  beforeEach(() => {
    clientMock.vault.current.mockReset();
    clientMock.vault.list.mockReset();
    clientMock.vault.open.mockReset();
    clientMock.vault.watcherStart.mockReset();
    clientMock.vault.watcherStop.mockReset();
    clientMock.events.on.mockReset();
    clientMock.vault.watcherStart.mockResolvedValue(undefined);
    clientMock.vault.watcherStop.mockResolvedValue(undefined);
    useVaultStore.setState({ path: null, notes: [], isLoading: false, error: null });
  });

  it("loads the current vault notes", async () => {
    clientMock.vault.current.mockResolvedValue({ path: "/vault" });
    clientMock.vault.list.mockResolvedValue([
      { id: "1", path: "/vault/a.md", title: "A", folder: "", size: 1, mtime: 1 },
    ]);

    await useVaultStore.getState().loadNotes();

    expect(useVaultStore.getState().path).toBe("/vault");
    expect(useVaultStore.getState().notes).toHaveLength(1);
  });

  it("updates local cache when an external file event arrives", async () => {
    const listener: { callback: ((event: IpcEventPayload<"vault:fileChanged">) => void) | null } = {
      callback: null,
    };
    clientMock.events.on.mockImplementation((_event, cb) => {
      listener.callback = cb;
      return Promise.resolve(vi.fn());
    });
    clientMock.vault.current.mockResolvedValue({ path: "/vault" });
    clientMock.vault.list.mockResolvedValue([
      { id: "1", path: "/vault/a.md", title: "A", folder: "", size: 20, mtime: 30 },
    ]);
    useVaultStore.setState({
      path: "/vault",
      notes: [{ id: "1", path: "/vault/a.md", title: "A", folder: "", size: 1, mtime: 1 }],
    });

    await useVaultStore.getState().startWatcherIntegration();
    listener.callback?.({ path: "/vault/a.md", kind: "modified", source: "external", size: 20, mtime: 30 });
    await vi.waitFor(() => expect(useVaultStore.getState().notes[0]?.mtime).toBe(30));

    expect(clientMock.vault.watcherStart).toHaveBeenCalled();
  });
});
