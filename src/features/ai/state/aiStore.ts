import { create } from "zustand";

import { buildContext, sendPrompt as ipcSendPrompt } from "@/features/ai/services/aiClient";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

type AiStore = {
  messages: AiMessage[];
  isLoading: boolean;
  error: string | null;
  panelOpen: boolean;
  togglePanel(): void;
  sendPrompt(prompt: string, noteId: string | null): Promise<void>;
  clearChat(): void;
};

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `msg-${Date.now()}-${_idCounter}`;
}

export const useAiStore = create<AiStore>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  panelOpen: false,

  togglePanel() {
    set((state) => ({ panelOpen: !state.panelOpen }));
  },

  async sendPrompt(prompt: string, noteId: string | null) {
    const { isLoading } = get();
    if (isLoading || !prompt.trim()) {
      return;
    }

    const userMessage: AiMessage = {
      id: nextId(),
      role: "user",
      content: prompt.trim(),
      timestamp: Date.now(),
    };

    set({ isLoading: true, error: null, messages: [...get().messages, userMessage] });

    try {
      const provider = useAppSettingsStore.getState().settings.ai?.provider ?? "disabled";
      const context = buildContext(noteId);
      const reply = await ipcSendPrompt(provider, prompt.trim(), context);

      const assistantMessage: AiMessage = {
        id: nextId(),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        error: null,
      }));
    } catch (error: unknown) {
      const errMsg = extractErrorMessage(error);
      set((state) => ({
        isLoading: false,
        error: errMsg,
        messages: [
          ...state.messages,
          { id: nextId(), role: "assistant", content: `**Error:** ${errMsg}`, timestamp: Date.now() },
        ],
      }));
    }
  },

  clearChat() {
    set({ messages: [], error: null });
  },
}));

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") {
      return err.message;
    }
    // Tauri IPC errors come as { kind, message }
    if (typeof err.kind === "string" && typeof err.message === "string") {
      return err.message;
    }
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred.";
}
