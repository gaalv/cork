import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { CommandPalette } from "./CommandPalette";

beforeEach(() => {
  useShellStore.getState().reset();
  useVaultStore.setState({
    path: "/vault",
    notes: [
      { id: "n1", path: "/vault/Alpha.md", title: "Alpha Note", folder: "", size: 1, mtime: 1 },
      { id: "n2", path: "/vault/projects/Beta.md", title: "Beta Plan", folder: "projects", size: 1, mtime: 2 },
    ],
    openVault: vi.fn().mockResolvedValue(undefined),
  });
  useIndexStore.setState({
    recentNotes: [{ id: "n2", path: "/vault/projects/Beta.md", title: "Beta Plan", folder: "projects", size: 1, mtime: 2 }],
    tags: [{ tag: "work", count: 2 }],
    rebuild: vi.fn().mockResolvedValue(undefined),
  });
});

describe("CommandPalette", () => {
  it("filters results and opens a note with enter selection", () => {
    useShellStore.getState().openPalette();
    render(<CommandPalette />);

    fireEvent.change(screen.getByLabelText("Command palette", { selector: "input" }), { target: { value: "Alpha" } });
    fireEvent.click(screen.getByText("Alpha Note"));

    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "n1" });
    expect(useShellStore.getState().paletteOpen).toBe(false);
  });

  it("shows the no-match create affordance", () => {
    const onCreateNote = vi.fn();
    useShellStore.getState().openPalette();
    render(<CommandPalette onCreateNote={onCreateNote} />);

    fireEvent.change(screen.getByLabelText("Command palette", { selector: "input" }), { target: { value: "Zeta" } });
    fireEvent.click(screen.getByRole("button", { name: "Create note “Zeta”" }));

    expect(onCreateNote).toHaveBeenCalledWith("Zeta");
  });
});
