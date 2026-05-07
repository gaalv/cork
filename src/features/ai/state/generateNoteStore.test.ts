import { beforeEach, describe, expect, it, vi } from "vitest";

const { skillsClientMock, ipcClientMock, vaultStoreMock, shellStoreMock, sonnerMock } = vi.hoisted(() => ({
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
  sonnerMock: {
    toast: Object.assign(vi.fn(), {
      loading: vi.fn(() => "tid"),
      success: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock("@/features/ai/services/skillsClient", () => skillsClientMock);
vi.mock("@/shared/ipc/client", () => ipcClientMock);
vi.mock("@/features/vault/state/vaultStore", () => vaultStoreMock);
vi.mock("@/features/shell/state/shellStore", () => shellStoreMock);
vi.mock("sonner", () => sonnerMock);

import { useGenerateNoteStore } from "./generateNoteStore";

const initialState = useGenerateNoteStore.getState();

beforeEach(() => {
  skillsClientMock.runSkill.mockReset();
  ipcClientMock.client.notes.create.mockReset();
  ipcClientMock.client.notes.save.mockReset();
  vaultStoreMock.useVaultStore.getState.mockReset();
  shellStoreMock.useShellStore.getState.mockReset();
  sonnerMock.toast.loading.mockClear();
  sonnerMock.toast.loading.mockReturnValue("tid");
  sonnerMock.toast.success.mockClear();
  sonnerMock.toast.error.mockClear();
  useGenerateNoteStore.setState(initialState);
});

describe("generateNoteStore", () => {
  it("openModal/closeModal toggles state", () => {
    useGenerateNoteStore.getState().openModal();
    expect(useGenerateNoteStore.getState().open).toBe(true);
    useGenerateNoteStore.getState().closeModal();
    expect(useGenerateNoteStore.getState().open).toBe(false);
  });

  it("rejects empty topic without closing modal", async () => {
    useGenerateNoteStore.setState({ open: true });
    await useGenerateNoteStore.getState().generate({ topic: "  ", folder: "" });
    expect(useGenerateNoteStore.getState().error).toBe("Topic is required");
    expect(useGenerateNoteStore.getState().open).toBe(true);
    expect(skillsClientMock.runSkill).not.toHaveBeenCalled();
    expect(sonnerMock.toast.loading).not.toHaveBeenCalled();
  });

  it("happy path closes modal, shows toast, creates note, and exposes Open action", async () => {
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

    expect(sonnerMock.toast.loading).toHaveBeenCalledTimes(1);
    expect(skillsClientMock.runSkill).toHaveBeenCalledWith("generate-note", { topic: "Hi", context: "" });
    expect(ipcClientMock.client.notes.create).toHaveBeenCalledWith({ folder: "Inbox", title: "Hi" });
    expect(ipcClientMock.client.notes.save).toHaveBeenCalledWith({
      path: "Inbox/Hi.md",
      frontmatter: { generated_by: "ai", topic: "Hi" },
      body: "# Body\n",
    });
    // Modal closed before generation finished
    expect(useGenerateNoteStore.getState().open).toBe(false);
    expect(useGenerateNoteStore.getState().status).toBe("idle");
    // Success toast updates the loading toast in place
    expect(sonnerMock.toast.success).toHaveBeenCalledTimes(1);
    const successCall = sonnerMock.toast.success.mock.calls[0];
    expect(successCall[0]).toBe("Note ready");
    expect(successCall[1].id).toBe("tid");
    // Action triggers navigation only when clicked
    expect(navigate).not.toHaveBeenCalled();
    successCall[1].action.onClick();
    expect(navigate).toHaveBeenCalledWith({ kind: "note", id: "n1" });
  });

  it("captures error from runSkill and shows error toast", async () => {
    skillsClientMock.runSkill.mockRejectedValue({ message: "AI down" });
    useGenerateNoteStore.setState({ open: true });
    await useGenerateNoteStore.getState().generate({ topic: "X", folder: "" });
    expect(useGenerateNoteStore.getState().status).toBe("error");
    expect(useGenerateNoteStore.getState().error).toBe("AI down");
    expect(useGenerateNoteStore.getState().open).toBe(false);
    expect(sonnerMock.toast.error).toHaveBeenCalledTimes(1);
    expect(sonnerMock.toast.error.mock.calls[0][1].id).toBe("tid");
  });

  it("ignores duplicate generate calls while already loading", async () => {
    useGenerateNoteStore.setState({ status: "loading" });
    await useGenerateNoteStore.getState().generate({ topic: "X", folder: "" });
    expect(skillsClientMock.runSkill).not.toHaveBeenCalled();
    expect(sonnerMock.toast.loading).not.toHaveBeenCalled();
  });
});
