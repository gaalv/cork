import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteViewStore } from "@/features/note-view/state/noteViewStore";

import { NoteMetaPanel } from "./NoteMetaPanel";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    links: { incoming: vi.fn() },
    notes: { byId: vi.fn() },
    events: { on: vi.fn() },
    vcs: { status: vi.fn(), history: vi.fn(), restore: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  useNoteViewStore.getState().reset();
  clientMock.links.incoming.mockReset();
  clientMock.notes.byId.mockReset();
  clientMock.events.on.mockReset();
  clientMock.vcs.status.mockReset();
  clientMock.vcs.history.mockReset();
  clientMock.links.incoming.mockResolvedValue([]);
  clientMock.events.on.mockResolvedValue(vi.fn());
  clientMock.vcs.status.mockResolvedValue({ enabled: true, repoPath: "/vault", hasGit: true });
  clientMock.vcs.history.mockResolvedValue([]);
});

describe("NoteMetaPanel", () => {
  it("renders outline, backlinks, and AI stub", async () => {
    render(<NoteMetaPanel noteId="n1" body={"# Title\nBody"} onOpenNote={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Title" })).toBeInTheDocument());
    expect(screen.getByText("No backlinks yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Insights" })).toBeInTheDocument();
  });

  it("toggles collapsed state via store", () => {
    render(<NoteMetaPanel noteId="n1" body="" onOpenNote={vi.fn()} />);

    expect(screen.getByLabelText("Note metadata").getAttribute("data-collapsed")).toBe("false");
    useNoteViewStore.getState().togglePanelCollapsed();
    expect(useNoteViewStore.getState().panelCollapsed).toBe(true);
  });
});
