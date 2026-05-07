import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";

import { useAiStore } from "./aiStore";

// Hoist mocks so they're available before module initialisation
const { buildContextMock, sendPromptMock, getSettingsMock } = vi.hoisted(() => ({
  buildContextMock: vi.fn(),
  sendPromptMock: vi.fn(),
  getSettingsMock: vi.fn(),
}));

vi.mock("@/features/ai/services/aiClient", () => ({
  buildContext: buildContextMock,
  sendPrompt: sendPromptMock,
}));

vi.mock("@/features/settings/state/appSettingsStore", () => ({
  useAppSettingsStore: {
    getState: () => ({ settings: getSettingsMock() }),
  },
}));

beforeEach(() => {
  // Reset store state
  useAiStore.setState({
    messages: [],
    isLoading: false,
    error: null,
    panelOpen: false,
  });

  buildContextMock.mockReset();
  sendPromptMock.mockReset();
  getSettingsMock.mockReset();

  buildContextMock.mockReturnValue("Note context here");
  getSettingsMock.mockReturnValue({ ai: { provider: "claude" } });
});

describe("useAiStore — togglePanel", () => {
  it("opens the panel when closed", () => {
    useAiStore.getState().togglePanel();
    expect(useAiStore.getState().panelOpen).toBe(true);
  });

  it("closes the panel when open", () => {
    useAiStore.setState({ panelOpen: true });
    useAiStore.getState().togglePanel();
    expect(useAiStore.getState().panelOpen).toBe(false);
  });
});

describe("useAiStore — clearChat", () => {
  it("clears messages and error", () => {
    useAiStore.setState({
      messages: [{ id: "1", role: "user", content: "hi", timestamp: 1 }],
      error: "Something went wrong",
    });
    useAiStore.getState().clearChat();
    expect(useAiStore.getState().messages).toHaveLength(0);
    expect(useAiStore.getState().error).toBeNull();
  });
});

describe("useAiStore — sendPrompt", () => {
  it("appends user message immediately, then assistant message on success", async () => {
    sendPromptMock.mockResolvedValue("Hello from AI!");

    await act(async () => {
      await useAiStore.getState().sendPrompt("What is this note about?", "note-1");
    });

    const { messages } = useAiStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What is this note about?");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Hello from AI!");
    expect(useAiStore.getState().isLoading).toBe(false);
    expect(useAiStore.getState().error).toBeNull();
  });

  it("passes provider and context to sendPrompt", async () => {
    sendPromptMock.mockResolvedValue("reply");

    await act(async () => {
      await useAiStore.getState().sendPrompt("question", "note-1");
    });

    expect(sendPromptMock).toHaveBeenCalledWith("claude", "question", "Note context here");
    expect(buildContextMock).toHaveBeenCalledWith("note-1");
  });

  it("appends error message on failure", async () => {
    sendPromptMock.mockRejectedValue({ kind: "binary_not_found", message: "Binary 'claude' not found" });

    await act(async () => {
      await useAiStore.getState().sendPrompt("question", "note-1");
    });

    const { messages, isLoading } = useAiStore.getState();
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toContain("Binary 'claude' not found");
    expect(isLoading).toBe(false);
  });

  it("does nothing when prompt is empty", async () => {
    await act(async () => {
      await useAiStore.getState().sendPrompt("  ", "note-1");
    });

    expect(useAiStore.getState().messages).toHaveLength(0);
    expect(sendPromptMock).not.toHaveBeenCalled();
  });

  it("does nothing when already loading", async () => {
    useAiStore.setState({ isLoading: true });
    await act(async () => {
      await useAiStore.getState().sendPrompt("question", "note-1");
    });
    expect(sendPromptMock).not.toHaveBeenCalled();
  });
});
