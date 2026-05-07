import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";

const { aiStoreMock, settingsMock } = vi.hoisted(() => ({
  aiStoreMock: {
    messages: [] as Array<{ id: string; role: string; content: string; timestamp: number }>,
    isLoading: false,
    panelOpen: true,
    error: null as string | null,
    togglePanel: vi.fn(),
    sendPrompt: vi.fn(),
    clearChat: vi.fn(),
  },
  settingsMock: {
    settings: { ai: { provider: "disabled" } },
  },
}));

vi.mock("@/features/ai/state/aiStore", () => ({
  useAiStore: (selector: (s: typeof aiStoreMock) => unknown) => selector(aiStoreMock),
}));

vi.mock("@/features/settings/state/appSettingsStore", () => ({
  useAppSettingsStore: (selector: (s: typeof settingsMock) => unknown) => selector(settingsMock),
}));

// react-markdown uses ESM; mock it to avoid transform issues in vitest
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

beforeEach(() => {
  aiStoreMock.messages = [];
  aiStoreMock.isLoading = false;
  aiStoreMock.panelOpen = true;
  aiStoreMock.error = null;
  aiStoreMock.togglePanel.mockReset();
  aiStoreMock.sendPrompt.mockReset();
  aiStoreMock.clearChat.mockReset();
  settingsMock.settings = { ai: { provider: "disabled" } };
});

describe("ChatPanel — disabled state", () => {
  it("shows configure hint when provider is disabled", () => {
    render(<ChatPanel noteId="note-1" />);
    expect(screen.getByText(/No AI provider configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Settings → AI/i)).toBeInTheDocument();
  });

  it("does not show input when provider is disabled", () => {
    render(<ChatPanel noteId="note-1" />);
    expect(screen.queryByRole("textbox", { name: /chat input/i })).not.toBeInTheDocument();
  });
});

describe("ChatPanel — with provider configured", () => {
  beforeEach(() => {
    settingsMock.settings = { ai: { provider: "claude" } };
  });

  it("shows input when provider is configured", () => {
    render(<ChatPanel noteId="note-1" />);
    expect(screen.getByRole("textbox", { name: /chat input/i })).toBeInTheDocument();
  });

  it("shows empty state message when no messages", () => {
    render(<ChatPanel noteId="note-1" />);
    expect(screen.getByText(/Ask Claude anything about this note/i)).toBeInTheDocument();
  });

  it("sends prompt on button click", async () => {
    aiStoreMock.sendPrompt.mockResolvedValue(undefined);
    render(<ChatPanel noteId="note-1" />);

    const textarea = screen.getByRole("textbox", { name: /chat input/i });
    fireEvent.change(textarea, { target: { value: "What is this note about?" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(aiStoreMock.sendPrompt).toHaveBeenCalledWith("What is this note about?", "note-1");
    });
  });

  it("clears chat on clear button click", () => {
    render(<ChatPanel noteId="note-1" />);
    fireEvent.click(screen.getByRole("button", { name: /clear chat/i }));
    expect(aiStoreMock.clearChat).toHaveBeenCalled();
  });

  it("closes panel on close button click", () => {
    render(<ChatPanel noteId="note-1" />);
    fireEvent.click(screen.getByRole("button", { name: /close ai chat/i }));
    expect(aiStoreMock.togglePanel).toHaveBeenCalled();
  });

  it("renders user messages", () => {
    aiStoreMock.messages = [
      { id: "1", role: "user", content: "Hello AI", timestamp: 1 },
    ];
    render(<ChatPanel noteId="note-1" />);
    expect(screen.getByText("Hello AI")).toBeInTheDocument();
  });

  it("renders assistant messages via Markdown", () => {
    aiStoreMock.messages = [
      { id: "2", role: "assistant", content: "**Bold reply**", timestamp: 2 },
    ];
    render(<ChatPanel noteId="note-1" />);
    expect(screen.getByTestId("md")).toBeInTheDocument();
  });
});

describe("ChatPanel — hidden when panelOpen is false", () => {
  it("renders nothing when panelOpen is false", () => {
    aiStoreMock.panelOpen = false;
    const { container } = render(<ChatPanel noteId="note-1" />);
    expect(container.firstChild).toBeNull();
  });
});
