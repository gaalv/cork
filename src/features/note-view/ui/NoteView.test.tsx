import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { NoteView } from "./NoteView";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { read: vi.fn(), byId: vi.fn() },
    links: { incoming: vi.fn(), outgoing: vi.fn() },
    events: { on: vi.fn() },
    vcs: { status: vi.fn(), history: vi.fn(), restore: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.notes.read.mockReset();
  clientMock.notes.byId.mockReset();
  clientMock.links.incoming.mockReset();
  clientMock.links.outgoing.mockReset();
  clientMock.events.on.mockReset();
  clientMock.vcs.status.mockReset();
  clientMock.vcs.history.mockReset();
  clientMock.events.on.mockResolvedValue(vi.fn());
  clientMock.links.incoming.mockResolvedValue([]);
  clientMock.links.outgoing.mockResolvedValue([]);
  clientMock.notes.read.mockResolvedValue({ path: "/vault/a.md", frontmatter: { created: "2026-05-06" }, body: "# Alpha\nBody", mtime: 1 });
  clientMock.vcs.status.mockResolvedValue({ enabled: true, repoPath: "/vault", hasGit: true });
  clientMock.vcs.history.mockResolvedValue([]);
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "n1", path: "/vault/a.md", title: "Alpha", folder: "", size: 1, mtime: 1 }],
    isLoading: false,
    error: null,
  });
});

describe("NoteView", () => {
  it("renders editor split with metadata panel", async () => {
    render(<NoteView noteId="n1" title="Alpha" />);

    expect(screen.getByTestId("note-view")).toHaveTextContent("Alpha");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Outline" })).toBeInTheDocument());
    expect(screen.getByLabelText("Note metadata")).toBeInTheDocument();
  });
});
