import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { WikilinkPopover } from "./WikilinkPopover";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  vi.clearAllMocks();
  useShellStore.getState().reset();
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "new-id", path: "/vault/work/Target.md", title: "Target", folder: "work", size: 1, mtime: 1 }],
    isLoading: false,
    error: null,
    loadNotes: vi.fn().mockResolvedValue(undefined),
  });
});

describe("WikilinkPopover", () => {
  it("creates a missing note in the current folder and opens it", async () => {
    clientMock.notes.create.mockResolvedValue({ path: "/vault/work/Target.md" });

    render(<WikilinkPopover target="Target" currentFolder="work" />);
    fireEvent.click(screen.getByRole("button", { name: "Create “Target.md” here" }));

    await waitFor(() => expect(clientMock.notes.create).toHaveBeenCalledWith({ folder: "work", title: "Target" }));
    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "new-id" });
  });

  it("opens the palette to pick an existing note", () => {
    const onClose = vi.fn();

    render(<WikilinkPopover target="Target" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick existing note…" }));

    expect(useShellStore.getState().paletteOpen).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
