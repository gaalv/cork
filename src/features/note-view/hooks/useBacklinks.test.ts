import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBacklinks } from "./useBacklinks";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    links: { incoming: vi.fn() },
    notes: { byId: vi.fn() },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.links.incoming.mockReset();
  clientMock.notes.byId.mockReset();
  clientMock.events.on.mockReset();
  clientMock.events.on.mockResolvedValue(vi.fn());
});

describe("useBacklinks", () => {
  it("loads incoming links with source notes", async () => {
    clientMock.links.incoming.mockResolvedValue([
      { srcNoteId: "n2", targetText: "Alpha", targetId: "n1", position: 1, alias: null, ambiguous: false },
    ]);
    clientMock.notes.byId.mockResolvedValue({ id: "n2", path: "/vault/b.md", title: "Beta", folder: "", size: 1, mtime: 1 });

    const { result } = renderHook(() => useBacklinks("n1"));

    await waitFor(() => expect(result.current.backlinks[0]?.source?.title).toBe("Beta"));
  });
});
