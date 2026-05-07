import { beforeEach, describe, expect, it, vi } from "vitest";

const { skillsClientMock, ipcClientMock, vaultStoreMock, shellStoreMock } = vi.hoisted(() => ({
  skillsClientMock: { runSkill: vi.fn() },
  ipcClientMock: {
    client: {
      notes: {
        create: vi.fn(),
        save: vi.fn(),
      },
    },
  },
  vaultStoreMock: {
    useVaultStore: {
      getState: vi.fn(),
    },
  },
  shellStoreMock: {
    useShellStore: {
      getState: vi.fn(),
    },
  },
}));

vi.mock("@/features/ai/services/skillsClient", () => skillsClientMock);
vi.mock("@/shared/ipc/client", () => ipcClientMock);
vi.mock("@/features/vault/state/vaultStore", () => vaultStoreMock);
vi.mock("@/features/shell/state/shellStore", () => shellStoreMock);

import { useGenerateNoteStore } from "./generateNoteStore";

const initialState = useGenerateNoteStore.getState();

beforeEach(() => {
  skillsClientMock.runSkill.mockReset();
  ipcClientMock.client.notes.create.mockReset();
  ipcClientMock.client.notes.save.mockReset();
  vaultStoreMock.useVaultStore.getState.mockReset();
  shellStoreMock.useShellStore.getState.mockReset();
  useGenerateNoteStore.setState(initialState);
});

describe("generateNoteStore", () => {
  it("openModal/closeModal toggles state", () => {
    useGenerateNoteStore.getState().openModal();
    expect(useGenerateNoteStore.getState().open).toBe(true);
    useGenerateNoteStore.getState().closeModal();
    expect(useGenerateNoteStore.getState().open).toBe(false);
  });

  it("closeModal is no-op while loading", () => {
    useGenerateNoteStore.setState({ open: true, status: "loading" });
    useGenerateNoteStore.getState().closeModal();
    expect(useGenerateNoteStore.getState().open).toBe(true);
  });

  it("rejects empty topic", async () => {
    await useGenerateNoteStore.getState().generate({ topic: "  ", folder: "" });
    expect(useGenerateNoteStore.getState().error).toBe("Topic is required");
    expect(skillsClientMock.runSkill).not.toHaveBeenCalled();
  });

  it("happy path creates and navigates", async () => {
    skillsClientMock.runSkill.mockResolvedValue({ output: "# Body\n", cached: false });
    ipcClientMock.client.notes.create.mockResolvedValue({ path: "Inbox/Hi.md" });
    ipcClientMock.client.notes.save.mockResolvedValue({ path: "Inbox/Hi.md", mtime: 1 });
    const loadNotes = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();
    vaultStoreMock.useVaultStore.getState
      .mockReturnValueOnce({ loadNotes })
      .mockReturnValueOnce({ notes: [{ id: "n1", path: "Inbox/Hi.md" }] });
    shellStoreMock.useShellStore.getState.mockReturnValue({ navigate });

    useGenerateNoteStore.setState({ open: true });
    await useGenerateNoteStore.getState().generate({ topic: "Hi", folder: "Inbox" });

    expect(skillsClientMock.runSkill).toHaveBeenCalledWith("generate-note", { topic: "Hi" });
    expect(ipcClientMock.client.notes.create).toHaveBeenCalledWith({ folder: "Inbox", title: "Hi" });
    expect(ipcClientMock.client.notes.save).toHaveBeenCalledWith({
      path: "Inbox/Hi.md",
      frontmatter: { generated_by: "ai", topic: "Hi" },
      body: "# Body\n",
    });
    expect(navigate).toHaveBeenCalledWith({ kind: "note", id: "n1" });
    expect(useGenerateNoteStore.getState().open).toBe(false);
    expect(useGenerateNoteStore.getState().status).toBe("idle");
  });

  it("captures error from runSkill", async () => {
    skillsClientMock.runSkill.mockRejectedValue({ message: "AI down" });
    await useGenerateNoteStore.getState().generate({ topic: "X", folder: "" });
    expect(useGenerateNoteStore.getState().status).toBe("error");
    expect(useGenerateNoteStore.getState().error).toBe("AI down");
  });
});
