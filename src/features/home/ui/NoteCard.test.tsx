import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";

import { NoteCard } from "./NoteCard";

const { toggleStarMock, clientMock } = vi.hoisted(() => ({
  toggleStarMock: vi.fn(),
  clientMock: { notes: { trash: vi.fn() } },
}));

vi.mock("@/features/drawers/services/starService", () => ({ toggleStar: toggleStarMock }));
vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const note = {
  id: "n1",
  path: "/vault/a.md",
  title: "Alpha",
  folder: "work",
  size: 1,
  mtime: Date.UTC(2026, 4, 6),
  frontmatter: { pinned: true, starred: false },
  snippet: "Preview text",
  pinned: true,
  starred: false,
};

beforeEach(() => {
  toggleStarMock.mockReset();
  clientMock.notes.trash.mockReset();
  useShellStore.getState().reset();
});

describe("NoteCard", () => {
  it("opens the note from the card body", () => {
    const onOpen = vi.fn();

    render(<NoteCard note={note} onOpen={onOpen} onPinToggle={vi.fn()} />);
    fireEvent.click(screen.getByText("Alpha"));

    expect(onOpen).toHaveBeenCalledWith(note);
  });

  it("runs menu actions", async () => {
    const onPinToggle = vi.fn().mockResolvedValue(undefined);
    const onChanged = vi.fn();
    toggleStarMock.mockResolvedValue(true);

    render(<NoteCard note={note} onOpen={vi.fn()} onPinToggle={onPinToggle} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu for Alpha" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Unpin" }));

    await waitFor(() => expect(onPinToggle).toHaveBeenCalledWith(note));
    expect(onChanged).toHaveBeenCalled();
  });

  it("opens the folders drawer from reveal", () => {
    render(<NoteCard note={note} onOpen={vi.fn()} onPinToggle={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu for Alpha" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reveal in Folders" }));

    expect(useShellStore.getState().drawer).toBe("folders");
  });
});
