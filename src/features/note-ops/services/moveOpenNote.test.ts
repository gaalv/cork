import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { moveOpenNote } from "./moveOpenNote";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      move: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.notes.move.mockReset();
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "n1", path: "/vault/Inbox/Note.md", title: "Note", folder: "Inbox", size: 1, mtime: 1 }],
    loadNotes: vi.fn(async () => {}),
  } as never);
  useShellStore.setState({
    view: { kind: "home" },
    toasts: [],
  } as never);
});

describe("moveOpenNote", () => {
  it("calls notes.move and re-navigates", async () => {
    clientMock.notes.move.mockResolvedValue({ path: "archive" });
    const ok = await moveOpenNote("n1", "archive");
    expect(ok).toBe(true);
    expect(clientMock.notes.move).toHaveBeenCalledWith({
      notePath: "/vault/Inbox/Note.md",
      destFolder: "archive",
    });
    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "n1" });
  });

  it("noops when destination matches current folder", async () => {
    const ok = await moveOpenNote("n1", "Inbox");
    expect(ok).toBe(true);
    expect(clientMock.notes.move).not.toHaveBeenCalled();
  });

  it("returns false when note is unknown", async () => {
    const ok = await moveOpenNote("missing", "archive");
    expect(ok).toBe(false);
    expect(clientMock.notes.move).not.toHaveBeenCalled();
  });

  it("pushes an error toast when the IPC call fails", async () => {
    clientMock.notes.move.mockRejectedValue(new Error("disk full"));
    const ok = await moveOpenNote("n1", "archive");
    expect(ok).toBe(false);
    const toasts = useShellStore.getState().toasts;
    expect(toasts.at(-1)?.title).toBe("Move failed");
  });
});
