import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIndexStore } from "./indexStore";

import type { IpcEventName, IpcEventPayload } from "@/shared/ipc/IpcContract";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      allPaged: vi.fn(),
      recent: vi.fn(),
      byTag: vi.fn(),
      byFolder: vi.fn(),
      byId: vi.fn(),
    },
    tags: { list: vi.fn() },
    links: { outgoing: vi.fn(), incoming: vi.fn() },
    index: { search: vi.fn(), status: vi.fn(), rebuild: vi.fn() },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

describe("indexStore", () => {
  beforeEach(() => {
    clientMock.notes.allPaged.mockReset();
    clientMock.notes.recent.mockReset();
    clientMock.notes.byTag.mockReset();
    clientMock.notes.byFolder.mockReset();
    clientMock.notes.byId.mockReset();
    clientMock.tags.list.mockReset();
    clientMock.links.outgoing.mockReset();
    clientMock.links.incoming.mockReset();
    clientMock.index.search.mockReset();
    clientMock.index.status.mockReset();
    clientMock.index.rebuild.mockReset();
    clientMock.events.on.mockReset();
    useIndexStore.getState().stopIndexIntegration();
    useIndexStore.setState({ progress: null, ready: false, status: null, error: null, recentNotes: [], tags: [] });
  });

  it("loads ready status and home index data", async () => {
    clientMock.index.status.mockResolvedValue({ ready: true, vaultPath: "/vault", indexedNotes: 1, pendingJobs: 0 });
    clientMock.notes.recent.mockResolvedValue([
      { id: "n1", path: "/vault/a.md", title: "A", folder: "", size: 1, mtime: 2 },
    ]);
    clientMock.tags.list.mockResolvedValue([{ tag: "dev", count: 1 }]);

    await useIndexStore.getState().refreshStatus();

    expect(useIndexStore.getState().ready).toBe(true);
    expect(useIndexStore.getState().recentNotes).toHaveLength(1);
    expect(useIndexStore.getState().tags[0]?.tag).toBe("dev");
  });

  it("subscribes to progress and ready events", async () => {
    const listeners = new Map<IpcEventName, (payload: IpcEventPayload<IpcEventName>) => void>();
    clientMock.events.on.mockImplementation((event: IpcEventName, callback: (payload: IpcEventPayload<IpcEventName>) => void) => {
      listeners.set(event, callback);
      return Promise.resolve(vi.fn());
    });
    clientMock.index.status.mockResolvedValue({ ready: false, vaultPath: null, indexedNotes: 0, pendingJobs: 0 });
    clientMock.notes.recent.mockResolvedValue([]);
    clientMock.tags.list.mockResolvedValue([]);

    await useIndexStore.getState().startIndexIntegration();
    listeners.get("index:progress")?.({ processed: 5, total: 10, phase: "building" });
    listeners.get("index:ready")?.({ ready: true, vaultPath: "/vault", indexedNotes: 10, pendingJobs: 0 });

    expect(useIndexStore.getState().progress?.processed).toBe(5);
    expect(useIndexStore.getState().ready).toBe(true);
  });

  it("delegates query helpers to the IPC client", async () => {
    clientMock.notes.allPaged.mockResolvedValue([]);
    clientMock.notes.byTag.mockResolvedValue([]);

    await useIndexStore.getState().allPaged(30, 30);
    await useIndexStore.getState().byTag("dev");

    expect(clientMock.notes.allPaged).toHaveBeenCalledWith(30, 30);
    expect(clientMock.notes.byTag).toHaveBeenCalledWith("dev");
  });
});
