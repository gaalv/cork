import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";

import { TagsDrawer } from "./TagsDrawer";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    tags: { list: vi.fn() },
    notes: { byTag: vi.fn() },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.tags.list.mockReset();
  clientMock.notes.byTag.mockReset();
  clientMock.events.on.mockReset().mockResolvedValue(vi.fn());
  useDrawersStore.setState({
    expandedFolders: new Set<string>(),
    expandedTags: new Set<string>(),
    selectedTag: null,
    searchHistory: [],
  });
});

describe("TagsDrawer", () => {
  it("renders tag hierarchy and selected tag notes", async () => {
    const onOpenNote = vi.fn();
    clientMock.tags.list.mockResolvedValue([{ tag: "work/projects", count: 2 }]);
    clientMock.notes.byTag.mockResolvedValue([
      { id: "n1", path: "/vault/a.md", title: "Alpha", folder: "", size: 1, mtime: 1 },
    ]);

    render(<TagsDrawer onOpenNote={onOpenNote} />);

    fireEvent.click(await screen.findByRole("button", { name: /work 2/i }));
    fireEvent.click(await screen.findByRole("button", { name: /projects 2/i }));

    await waitFor(() => expect(clientMock.notes.byTag).toHaveBeenCalledWith("work/projects"));
    fireEvent.click(await screen.findByRole("button", { name: "Alpha" }));

    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("expands parent tags with arrow keys", async () => {
    clientMock.tags.list.mockResolvedValue([{ tag: "work/projects", count: 2 }]);

    render(<TagsDrawer />);

    fireEvent.keyDown(await screen.findByRole("button", { name: /work 2/i }), { key: "ArrowRight" });

    expect(await screen.findByRole("button", { name: /projects 2/i })).toBeInTheDocument();
  });

  it("renders an empty state", async () => {
    clientMock.tags.list.mockResolvedValue([]);

    render(<TagsDrawer />);

    expect(
      await screen.findByText("No tags yet. Create tags above or add them from the right sidebar of any note."),
    ).toBeInTheDocument();
  });
});
