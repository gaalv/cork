# F20 — AI Chat Panel: Tasks

## T1 — Spec documents  ✅
- [x] `.specs/features/F20-ai-chat/spec.md`
- [x] `.specs/features/F20-ai-chat/design.md`
- [x] `.specs/features/F20-ai-chat/tasks.md`
- [x] Update `.specs/DEFERRED.md` § D3

**Verify:** Files exist and are coherent.

---

## T2 — Rust `ai` module
- [ ] Create `src-tauri/src/ai/mod.rs` with `AiError`, `SendPromptInput`, `binary_available`, `ai_send_prompt`, unit tests.
- [ ] Add `pub mod ai;` to `src-tauri/src/lib.rs`.
- [ ] Add `ai::ai_send_prompt` to `invoke_handler!`.

**Verify:** `export PATH="$HOME/.cargo/bin:$PATH" && cd src-tauri && cargo check && cd ..`

---

## T3 — IPC contract + client
- [ ] Add `AiProvider` + `AiError` to `src/shared/ipc/types.ts`.
- [ ] Add `"ai.sendPrompt"` entry to `IpcCommandMap` in `src/shared/ipc/IpcContract.ts`.
- [ ] Add `"ai.sendPrompt": "ai_send_prompt"` to `commandNames` map.
- [ ] Add `toRustArgs` case for `ai.sendPrompt`.
- [ ] Add `client.ai.sendPrompt(...)` method.

**Verify:** `pnpm typecheck` clean.

---

## T4 — Settings (TypeScript + Rust)
- [ ] Add `AiProvider` type + `ai: { provider: AiProvider }` to `AppSettings` in `settingsTypes.ts`.
- [ ] Add default `ai: { provider: 'disabled' }` to `DEFAULT_APP_SETTINGS`.
- [ ] Add `"ai.provider"` to `SettingKey` union.
- [ ] Add `"ai"` to `SettingsSectionId` in `settingsUiStore.ts`.
- [ ] Add `"AI"` section entry to `sections` array in `SettingsPanel.tsx`.
- [ ] Implement `renderSection("ai", ...)` with a `Select` for provider.
- [ ] Add `AiSettings` struct to `src-tauri/src/settings.rs` + wire into `AppSettings`.

**Verify:** `pnpm typecheck` + `cargo check` clean.

---

## T5 — Frontend feature (store + client + UI)
- [ ] Create `src/features/ai/state/aiStore.ts`.
- [ ] Create `src/features/ai/services/aiClient.ts`.
- [ ] Create `src/features/ai/ui/MessageBubble.tsx`.
- [ ] Create `src/features/ai/ui/ChatPanel.tsx`.
- [ ] Add AI chat toggle button to `src/features/shell/ui/TopBar.tsx`.
- [ ] Render `<ChatPanel>` inside `NoteView.tsx`.

**Verify:** `pnpm typecheck` clean, panel renders.

---

## T6 — Tests
- [ ] `src/features/ai/state/aiStore.test.ts` — togglePanel, clearChat, sendPrompt success/error.
- [ ] `src/features/ai/services/aiClient.test.ts` — buildContext truncation, IPC mock.
- [ ] `src/features/ai/ui/ChatPanel.test.tsx` — disabled state, messages render, error state.
- [ ] Rust unit tests in `ai/mod.rs` — error kind mapping, binary name resolution.

**Verify:** `pnpm test` all passing (existing 271 + new F20 tests).

---

## T7 — Final validation
- [ ] `pnpm typecheck && pnpm test && pnpm build`
- [ ] `export PATH="$HOME/.cargo/bin:$PATH" && cd src-tauri && cargo check`
- [ ] Commit all changes with atomic commits.

---

## Commit order

1. `spec(F20): add spec, design, tasks documents + update DEFERRED.md`
2. `feat(F20): add Rust ai module with ai_send_prompt command`
3. `feat(F20): add ai.sendPrompt to IPC contract and client`
4. `feat(F20): extend AppSettings with ai.provider and add settings UI`
5. `feat(F20): add aiStore, aiClient, ChatPanel, MessageBubble`
6. `feat(F20): add AI chat toggle button to TopBar + render ChatPanel in NoteView`
7. `test(F20): add aiStore, aiClient, ChatPanel tests`
