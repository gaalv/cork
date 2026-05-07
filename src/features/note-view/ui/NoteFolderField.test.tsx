import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { NoteFolderField } from "./NoteFolderField";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { move: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.notes.move.mockReset();
  clientMock.notes.move.mockResolvedValue({ path: "archive" });
  useVaultStore.setState({
    path: "/vault",
    notes: [
      { id: "n1", path: "/vault/Inbox/Note.md", title: "Note", folder: "Inbox", size: 1, mtime: 1 },
      { id: "n2", path: "/vault/archive/Old.md", title: "Old", folder: "archive", size: 1, mtime: 1 },
    ],
    loadNotes: vi.fn(async () => {}),
  } as never);
});

describe("NoteFolderField", () => {
  it("lists existing folders + Root", () => {
    render(<NoteFolderField noteId="n1" />);
    const select = screen.getByLabelText("Move note to folder") as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);
    expect(options).toEqual(["", "archive", "Inbox"]);
    expect(select.value).toBe("Inbox");
  });

  it("invokes notes.move when the user picks a different folder", () => {
    render(<NoteFolderField noteId="n1" />);
    fireEvent.change(screen.getByLabelText("Move note to folder"), { target: { value: "archive" } });
    expect(clientMock.notes.move).toHaveBeenCalledWith({
      notePath: "/vault/Inbox/Note.md",
      destFolder: "archive",
    });
  });

  it("renders nothing when the note is unknown", () => {
    const { container } = render(<NoteFolderField noteId="missing" />);
    expect(container).toBeEmptyDOMElement();
  });
});
