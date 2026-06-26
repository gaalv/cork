# Deferred — ideas to revisit

These features were proposed but deferred from the original v1 sprint. Items here either shipped under a follow-up Fxx (status noted inline) or remain genuinely outstanding.

## D1 — Calendar / agenda + Google Calendar integration

**Status.** v0 (month grid with daily-note indicators) and v1 (right-side agenda panel) **shipped in F19**. The Calendar surface is also routed through the F31 tool-overlay so triage mode keeps its third column. See `.specs/features/F19-calendar-view/` and AD-046.

**Still deferred:**
- Google Calendar OAuth / one-way sync (using `tauri-plugin-oauth` or a Rust OAuth flow, store `refresh_token` in OS keychain).
- Week view and day view.
- Drag-to-create events.
- Recurring events.
- Settings flag to configure calendar source.

## D2 — GitHub sync (Obsidian-style) + per-note history sidebar

**Status.**
- v0 — local git only: `git init` on the vault, autocommit on save with a debounce, per-note history with restore → **shipped in F18** (`.specs/features/F18-local-git-sync/`, AD-045).
- v1 — GitHub remote push → **shipped in F26** with the SSH-only auth path locked in by AD-038 / F27. Sweep-on-sync (AD-039) commits the entire vault, not only the active note.
- Inspector "History" section under F32 (AD-048) now owns the per-note commit list inside the four-section panel.

**Still deferred (D2 remainder):**
- ~~Multi-device conflict resolution UI (current behaviour is conflict-as-copy).~~ → **Superseded by F37 — CRDT Sync.** Yjs CRDTs eliminate conflicts by construction; conflict-as-copy remains only as a git-level fallback for edge cases.
- In-sidebar diff view.
- Pull-on-open lifecycle hook (today sync is user-triggered + periodic background sweep).
- **NEW → F37 (M11):** Real-time multi-device sync via Yjs CRDT + optional WebSocket relay + WebRTC P2P. Git stays as archive/backup layer. See `.specs/features/F37-crdt-sync/`.

## D3 — AI integration (Claude Code + Copilot CLI)

**Status.** Generic chat panel (F20) shipped, then **superseded by F21–F24** (AD-036): a skills/cache/telemetry foundation (F21) plus three contextual surfaces — Insights sidebar (F22), Generate-from-topic palette command (F23), and editor slash commands (F24). All run through local `claude` / `copilot` CLI subprocesses with no HTTP providers, no embeddings, no RAG.

**Still deferred:**
- Streaming output — non-interactive subprocesses buffer stdout (L-017); current pattern is background dispatch + sonner toasts (AD-037).
- Multi-note context / pinned notes.
- Vector search / RAG / embeddings.
- AI-driven note editing beyond the four slash commands (e.g., agentic refactors).
- Cancel-in-flight for long calls.
- Conversation persistence (the F20 chat panel was removed under F22).
- Tool calls / function calling.

---

When you want to pick any of these up: open `.specs/features/F<NN>-<slug>/` with `tlc-spec-driven` and we'll size it from this sketch.
