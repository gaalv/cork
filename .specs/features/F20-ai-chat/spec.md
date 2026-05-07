# F20 — AI Chat Panel (v1)

## Overview

A right-side chat panel scoped to the currently open note. The user selects a provider (`claude` or `copilot`) in Settings; the Rust backend spawns the chosen CLI binary as a subprocess and pipes the prompt + note context through stdin. Single-shot request/response (no streaming). In-memory conversation only (no persistence across restarts).

This is **D3 v1** from `DEFERRED.md`. See that document for the full deferred backlog (multi-note RAG, streaming, AI-driven editing, conversation persistence).

---

## Requirements

### R1 — Provider settings
- **R1.1** `AppSettings` gains an `ai: { provider: 'disabled' | 'claude' | 'copilot' }` section, defaulting to `disabled`.
- **R1.2** The Settings panel has an "AI" section with a Select for the provider.
- **R1.3** The setting persists via the existing `settings.appSave` bridge.
- **R1.4** When `provider = 'disabled'` the chat panel shows a configuration hint; no subprocess is ever spawned.

### R2 — IPC command
- **R2.1** New Tauri command `ai_send_prompt` in `src-tauri/src/ai/mod.rs`.
- **R2.2** Input: `{ provider: string, prompt: string, context: string }`.
- **R2.3** Output on success: plain text reply from the subprocess stdout.
- **R2.4** Output on failure: `AiError { kind: "provider_disabled" | "binary_not_found" | "subprocess_failed" | "timeout"; message: string }`.
- **R2.5** Binary discovery uses `which <binary>` on Unix / `where <binary>` on Windows. If not found, returns `binary_not_found`.
- **R2.6** The full prompt (user message + context) is written to the subprocess **stdin**, never passed as an argv string.
- **R2.7** A 60-second timeout is enforced; exceeding it returns `timeout`.
- **R2.8** Non-zero exit status returns `subprocess_failed` with the stderr captured.

### R3 — Context building
- **R3.1** Context sent to the AI includes: note title, frontmatter key/value pairs, and note body.
- **R3.2** Total context size is capped at 50 KB (UTF-8 bytes); excess is truncated with a notice.

### R4 — AI chat panel (frontend)
- **R4.1** A toggleable right-side panel (`ChatPanel`) rendered inside `NoteView`.
- **R4.2** Toggle button is added to the TopBar when a note is open (brain/chat icon).
- **R4.3** Panel header shows the active provider name and has a "Clear" button and a close "×" button.
- **R4.4** A scrollable message list renders user and assistant bubbles (`MessageBubble`).
- **R4.5** Assistant replies are rendered as Markdown using `react-markdown` (already in deps).
- **R4.6** An input textarea at the bottom with Cmd+Enter / Ctrl+Enter to send.
- **R4.7** While a request is in-flight, the input and send button are disabled and a spinner is shown.
- **R4.8** Error messages (any `AiError` kind) are rendered inline in the chat, not as toasts.
- **R4.9** When `provider = 'disabled'`, the panel shows "Configure a provider in Settings → AI" and hides the input.

### R5 — Zustand store
- **R5.1** `useAiStore` holds: `messages: AiMessage[]`, `isLoading: boolean`, `error: string | null`, `panelOpen: boolean`.
- **R5.2** Actions: `togglePanel()`, `sendPrompt(prompt, noteId)`, `clearChat()`.
- **R5.3** `sendPrompt` reads current note context via `useEditorStore.getState()` + `useVaultStore.getState()`, then calls the IPC command.
- **R5.4** Chat history is in-memory only; cleared on `clearChat()` or app restart.

### R6 — No-subprocess guarantee
- **R6.1** When provider is `disabled`, the `ai_send_prompt` command returns `provider_disabled` without attempting to spawn any process.
- **R6.2** The frontend never calls the IPC command when provider is `disabled`.

---

## Out of scope (deferred — see DEFERRED.md § D3)
- Streaming output
- Multi-note / pinned-note context
- Vector search / RAG / embeddings
- AI-driven note editing
- Conversation persistence across restarts
- Tool calls / function calling

---

## Acceptance criteria
- `pnpm typecheck` passes.
- `pnpm test` passes (271 existing + new F20 tests).
- `pnpm build` succeeds.
- `cargo check` (in `src-tauri/`) passes.
- With `provider = disabled`: panel shows configuration hint, no subprocess spawned.
- With `provider = claude` (assume `claude` binary on PATH): prompt invokes the IPC command, Rust spawns the subprocess via stdin, reply shown in panel.
- Errors (binary not found, timeout, non-zero exit) render gracefully inside the chat.
- DEFERRED.md updated for D3 v1.

---

## Status

Implemented as D3 v1:
- Rust `ai` module with `ai_send_prompt` command (binary discovery, stdin piping, 60s timeout, error mapping)
- IPC contract and client for `ai.sendPrompt`
- `AppSettings.ai.provider` with default `disabled`
- Settings "AI" section with provider Select
- `useAiStore` Zustand store
- `aiClient` service (context builder + IPC wrapper)
- `ChatPanel` + `MessageBubble` components
- Toggle button in TopBar

Deferred to future iterations (see DEFERRED.md § D3):
- Streaming output
- Multi-note context / RAG
- AI-driven note editing
- Conversation persistence
