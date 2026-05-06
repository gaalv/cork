import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { useHomeSections } from "./useHomeSections";

import type { IpcEventName, IpcEventPayload } from "@/shared/ipc/IpcContract";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { recent: vi.fn(), read: vi.fn() },
    tags: { list: vi.fn() },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const notes = [
  { id: "n1", path: "/vault/a.md", title: "Alpha", folder: "", size: 1, mtime: 30 },
  { id: "n2", path: "/vault/b.md", title: "Beta", folder: "", size: 1, mtime: 20 },
  { id: "n3", path: "/vault/c.md", title: "Gamma", folder: "", size: 1, mtime: 10 },
];

beforeEach(() => {
  clientMock.notes.recent.mockReset();
  clientMock.notes.read.mockReset();
  clientMock.tags.list.mockReset();
  clientMock.events.on.mockReset();
  clientMock.events.on.mockResolvedValue(vi.fn());
  useVaultStore.setState({ path: "/vault", notes, isLoading: false, error: null });
});

describe("useHomeSections", () => {
  it("aggregates pinned, recents, tags, and the first all-notes page", async () => {
    clientMock.notes.recent.mockResolvedValue(notes);
    clientMock.tags.list.mockResolvedValue([{ tag: "dev", count: 2 }]);
    clientMock.notes.read.mockImplementation((path: string) =>
      Promise.resolve({ path, frontmatter: { pinned: path.endsWith("a.md") }, body: "# Snippet", mtime: 1 }),
    );

    const { result } = renderHook(() => useHomeSections());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pinned.map((note) => note.id)).toEqual(["n1"]);
    expect(result.current.recents).toHaveLength(3);
    expect(result.current.tagsTop[0]?.tag).toBe("dev");
    expect(result.current.allPage.map((note) => note.id)).toEqual(["n1", "n2", "n3"]);
  });

  it("refreshes when vault file changes", async () => {
    const listeners = new Map<IpcEventName, (payload: IpcEventPayload<IpcEventName>) => void>();
    clientMock.events.on.mockImplementation((event: IpcEventName, callback: (payload: IpcEventPayload<IpcEventName>) => void) => {
      listeners.set(event, callback);
      return Promise.resolve(vi.fn());
    });
    clientMock.notes.recent.mockResolvedValue(notes);
    clientMock.tags.list.mockResolvedValue([]);
    clientMock.notes.read.mockResolvedValue({ path: "/vault/a.md", frontmatter: {}, body: "Body", mtime: 1 });

    renderHook(() => useHomeSections());
    await waitFor(() => expect(clientMock.notes.recent).toHaveBeenCalledTimes(1));

    await act(async () => {
      listeners.get("vault.fileChanged")?.({ path: "/vault/a.md", kind: "modified", source: "external", mtime: 2, size: 3 });
    });

    await waitFor(() => expect(clientMock.notes.recent).toHaveBeenCalledTimes(2));
  });
});
