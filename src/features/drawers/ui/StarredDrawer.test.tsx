import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StarredDrawer } from "./StarredDrawer";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { starred: vi.fn() },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.notes.starred.mockReset();
  clientMock.events.on.mockReset().mockResolvedValue(vi.fn());
});

describe("StarredDrawer", () => {
  it("renders starred notes", async () => {
    const onOpenNote = vi.fn();
    clientMock.notes.starred.mockResolvedValue([
      { id: "n1", path: "/vault/a.md", title: "Alpha", folder: "work", size: 1, mtime: 1 },
    ]);

    render(<StarredDrawer onOpenNote={onOpenNote} />);

    await waitFor(() => expect(clientMock.notes.starred).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: /Alpha/i }));

    expect(onOpenNote).toHaveBeenCalledWith("n1");
  });

  it("renders an empty state", async () => {
    clientMock.notes.starred.mockResolvedValue([]);

    render(<StarredDrawer />);

    expect(await screen.findByText("Star a note to see it here.")).toBeInTheDocument();
  });
});
