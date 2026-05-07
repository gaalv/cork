import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { createAndOpenNote, defaultNewNoteFolder, DEFAULT_INBOX_FOLDER } from "./createAndOpenNote";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.notes.create.mockReset();
  useDrawersStore.setState({ selectedFolder: null });
  useVaultStore.setState({
    path: "/vault",
    notes: [],
    loadNotes: vi.fn(async () => {
      useVaultStore.setState({
        notes: [{ id: "n1", path: "/vault/Inbox/Note.md", title: "Note", folder: "Inbox", size: 1, mtime: 1 }],
      });
    }),
  } as never);
  useShellStore.setState({ view: { kind: "home" } } as never);
});

describe("defaultNewNoteFolder", () => {
  it("returns Inbox when no folder is selected", () => {
    expect(defaultNewNoteFolder()).toBe(DEFAULT_INBOX_FOLDER);
  });

  it("returns the selected folder when one is set", () => {
    useDrawersStore.getState().selectFolder("work");
    expect(defaultNewNoteFolder()).toBe("work");
  });
});

describe("createAndOpenNote", () => {
  it("creates a note in Inbox by default", async () => {
    clientMock.notes.create.mockResolvedValue({ path: "/vault/Inbox/Note.md" });
    await createAndOpenNote();
    expect(clientMock.notes.create).toHaveBeenCalledWith({ folder: "Inbox", title: undefined });
  });

  it("uses the selected folder when one is set", async () => {
    clientMock.notes.create.mockResolvedValue({ path: "/vault/work/Note.md" });
    useDrawersStore.getState().selectFolder("work");
    await createAndOpenNote();
    expect(clientMock.notes.create).toHaveBeenCalledWith({ folder: "work", title: undefined });
  });

  it("respects an explicit folder argument", async () => {
    clientMock.notes.create.mockResolvedValue({ path: "/vault/journal/Note.md" });
    useDrawersStore.getState().selectFolder("work");
    await createAndOpenNote({ folder: "journal" });
    expect(clientMock.notes.create).toHaveBeenCalledWith({ folder: "journal", title: undefined });
  });
});
