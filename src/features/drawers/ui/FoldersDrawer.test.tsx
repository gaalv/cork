import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { FoldersDrawer } from "./FoldersDrawer";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    folders: {
      list: vi.fn(),
      create: vi.fn(),
      rename: vi.fn(),
      move: vi.fn(),
      trash: vi.fn(),
    },
    notes: {
      create: vi.fn(),
      bulkMove: vi.fn(),
      bulkTrash: vi.fn(),
      bulkSetFrontmatter: vi.fn(),
    },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.folders.list.mockReset().mockResolvedValue([]);
  clientMock.events.on.mockReset().mockResolvedValue(vi.fn());
  useDrawersStore.setState({
    expandedFolders: new Set<string>(),
    expandedTags: new Set<string>(),
    selectedFolder: null,
    selectedTag: null,
    searchHistory: [],
  });
  useVaultStore.setState({
    path: "/vault",
    notes: [
      { id: "n1", path: "/vault/work/a.md", title: "Alpha", folder: "work", size: 1, mtime: 1 },
      { id: "n2", path: "/vault/work/projects/b.md", title: "Beta", folder: "work/projects", size: 1, mtime: 1 },
    ],
  });
});

describe("FoldersDrawer", () => {
  it("renders folder counts and opens notes inline", () => {
    const onOpenNote = vi.fn();

    render(<FoldersDrawer onOpenNote={onOpenNote} />);
    fireEvent.click(screen.getByRole("button", { name: "work" }));

    expect(screen.getByRole("button", { name: /Alpha/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alpha/i }));

    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("expands folders with arrow keys", () => {
    render(<FoldersDrawer />);

    fireEvent.keyDown(screen.getByRole("button", { name: "work" }), { key: "ArrowRight" });

    expect(screen.getByRole("button", { name: /Alpha/i })).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    useVaultStore.setState({ notes: [] });

    render(<FoldersDrawer />);

    expect(screen.getByText("No notes in this vault yet.")).toBeInTheDocument();
  });

  it("treats vault root as the Inbox: notes without a folder appear under Inbox", () => {
    useVaultStore.setState({
      path: "/vault",
      notes: [
        { id: "i1", path: "/vault/Quick.md", title: "Quick", folder: "", size: 1, mtime: 1 },
        { id: "n1", path: "/vault/work/a.md", title: "Alpha", folder: "work", size: 1, mtime: 1 },
      ],
    });

    const onOpenNote = vi.fn();
    render(<FoldersDrawer onOpenNote={onOpenNote} />);

    const inboxButton = screen.getByRole("button", { name: "Inbox" });
    expect(inboxButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Quick/i }));
    expect(onOpenNote).toHaveBeenCalledWith("i1");
  });
});
