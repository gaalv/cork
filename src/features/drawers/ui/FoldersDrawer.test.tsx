import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { FoldersDrawer } from "./FoldersDrawer";

beforeEach(() => {
  useDrawersStore.setState({
    expandedFolders: new Set<string>(),
    expandedTags: new Set<string>(),
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
    fireEvent.click(screen.getByRole("treeitem", { name: /work 2/i }).querySelector("button")!);

    expect(screen.getByRole("button", { name: /Alpha/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Alpha/i }));

    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("shows an empty state", () => {
    useVaultStore.setState({ notes: [] });

    render(<FoldersDrawer />);

    expect(screen.getByText("No notes in this vault yet.")).toBeInTheDocument();
  });
});
