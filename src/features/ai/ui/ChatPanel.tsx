import { useEffect, useRef, useState } from "react";
import { ArrowUp, Spinner, Trash, X } from "@phosphor-icons/react";

import { useAiStore } from "@/features/ai/state/aiStore";
import { MessageBubble } from "@/features/ai/ui/MessageBubble";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";

const PROVIDER_LABELS: Record<string, string> = {
  disabled: "Disabled",
  claude: "Claude",
  copilot: "Copilot",
};

type ChatPanelProps = {
  noteId: string | null;
};

export function ChatPanel({ noteId }: ChatPanelProps) {
  const panelOpen = useAiStore((state) => state.panelOpen);
  const messages = useAiStore((state) => state.messages);
  const isLoading = useAiStore((state) => state.isLoading);
  const togglePanel = useAiStore((state) => state.togglePanel);
  const sendPrompt = useAiStore((state) => state.sendPrompt);
  const clearChat = useAiStore((state) => state.clearChat);
  const provider = useAppSettingsStore((state) => state.settings.ai?.provider ?? "disabled");

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (panelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, panelOpen]);

  useEffect(() => {
    if (!panelOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        togglePanel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, togglePanel]);

  if (!panelOpen) {
    return null;
  }

  const isDisabled = provider === "disabled";
  const providerLabel = PROVIDER_LABELS[provider] ?? provider;

  async function handleSend() {
    if (!input.trim() || isLoading || isDisabled) {
      return;
    }
    const prompt = input;
    setInput("");
    await sendPrompt(prompt, noteId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <aside
      aria-label="AI chat"
      className="fixed top-14 right-0 bottom-0 z-30 flex w-96 flex-col border-l border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-xl"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-noxe-border)] px-4 py-3">
        <span className="flex-1 text-sm font-semibold text-[var(--color-noxe-ink)]">
          AI Chat
          {!isDisabled && (
            <span className="ml-1.5 rounded-full bg-[var(--color-noxe-panel-2)] px-2 py-0.5 text-[11px] text-[var(--color-noxe-muted)]">
              {providerLabel}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label="Clear chat"
          title="Clear chat"
          onClick={clearChat}
          className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <Trash size={15} />
        </button>
        <button
          type="button"
          aria-label="Close AI chat"
          onClick={togglePanel}
          className="rounded-md p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <X size={15} />
        </button>
      </div>

      {/* Disabled state */}
      {isDisabled ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-[var(--color-noxe-muted)]">
            No AI provider configured.
          </p>
          <p className="text-xs text-[var(--color-noxe-muted)]">
            Go to{" "}
            <strong className="text-[var(--color-noxe-ink)]">Settings → AI</strong>{" "}
            to choose a provider (<code>claude</code> or <code>copilot</code>) and make
            sure the binary is installed on your PATH.
          </p>
        </div>
      ) : (
        <>
          {/* Message list */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-center text-xs text-[var(--color-noxe-muted)]">
                Ask {providerLabel} anything about this note.
              </p>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-[var(--color-noxe-panel-2)] px-3 py-2">
                  <Spinner size={16} className="animate-spin text-[var(--color-noxe-muted)]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-[var(--color-noxe-border)] p-3">
            <div className="flex items-end gap-2 rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-3 py-2">
              <textarea
                ref={textareaRef}
                aria-label="Chat input"
                placeholder="Ask about this note… (⌘↵ to send)"
                rows={2}
                className="min-h-0 flex-1 resize-none bg-transparent text-sm text-[var(--color-noxe-ink)] placeholder-[var(--color-noxe-muted)] outline-none"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                type="button"
                aria-label="Send message"
                onClick={() => void handleSend()}
                disabled={isLoading || !input.trim()}
                className="shrink-0 rounded-lg bg-[var(--color-noxe-primary)] p-1.5 text-[var(--color-noxe-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
              >
                <ArrowUp size={14} weight="bold" />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
