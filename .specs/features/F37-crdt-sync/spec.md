# F37 — CRDT Sync (Yjs + Git)

## Overview

Replace Cork's current "edit → save `.md` → git commit" pipeline with a CRDT-first data model where each note is backed by a Yjs `Y.Doc`. The editor binds to `Y.Text` via `y-codemirror.next`, giving conflict-free merges by construction. Git remains the archive and backup transport — it commits the `.md` snapshot that the CRDT flushes periodically, never seeing raw CRDT state as the authoritative content.

Three sync tiers are offered, each opt-in:

1. **Local-only** (always on) — `Y.Doc` persisted to `.cork/crdt/<note-hash>.yjs` on disk. Single-device, zero network.
2. **Git async** (existing F26 flow, unchanged) — periodic flush CRDT → `.md` → git commit + push. Multi-device, async, no conflicts because git only ever sees clean text.
3. **Real-time relay** (new) — Yjs WebSocket provider connects devices through a lightweight relay server. Edits propagate character-by-character. Optional WebRTC provider for LAN/P2P without any server.

Scope of F37: tiers 1–3 on the client side, plus a minimal self-hostable relay server. Hosted/managed relay infrastructure is out of scope (future product decision). Awareness protocol (remote cursors, presence) is in scope for the relay tier.

See `DEFERRED.md §D2` for historical context and `docs/DECISIONS.md §SD-005` for the strategic rationale.

## Decisions (locked)

- **Data model (SD-005):** Each note maps to one `Y.Doc` containing a single `Y.Text` for the body and a `Y.Map` for frontmatter fields. The `.md` file is the human-readable projection; the `.yjs` binary is the operational history.
- **Editor binding:** `y-codemirror.next` is the only supported CM6 ↔ Yjs bridge. No custom binding.
- **Provider architecture:** Yjs providers are pluggable and composable. Multiple providers can be active simultaneously (e.g., disk + relay). The app manages provider lifecycle per-note (connect on open, disconnect on close).
- **Git integration:** Git commits the `.md` file (flushed from CRDT) and optionally the `.yjs` file. The `.yjs` is never required for correctness — deleting it triggers a rebuild from `.md` with loss of operation history only.
- **Relay protocol:** Standard `y-websocket` protocol. The relay is stateless (broadcast only) unless persistence is enabled (optional LevelDB/SQLite store for offline device catch-up).
- **No account required:** Relay auth uses a per-vault shared secret (derived from vault ID + user-chosen passphrase). No user accounts, no email, no OAuth.

## Requirements

### R1 — Yjs document layer

- **R1.1** Each note in the vault has a corresponding `Y.Doc` instance managed by a `CrdtDocManager` service.
- **R1.2** The `Y.Doc` contains a `Y.Text("body")` holding the full note content and a `Y.Map("meta")` holding mutable frontmatter fields (`tags`, `pinned`, `title`).
- **R1.3** `CrdtDocManager` lazily loads `Y.Doc` instances — only the currently open note(s) are in memory. Background notes are on disk only.
- **R1.4** On note open: if `.cork/crdt/<note-hash>.yjs` exists, load the `Y.Doc` from its binary snapshot. If not, create a new `Y.Doc` and initialize `Y.Text` from the `.md` content (bootstrap).
- **R1.5** On note close: encode the `Y.Doc` to a binary snapshot (`Y.encodeStateAsUpdate`) and write to `.cork/crdt/<note-hash>.yjs`. Release the in-memory doc.
- **R1.6** The `<note-hash>` is a stable, filesystem-safe identifier derived from the note's vault-relative path (e.g., SHA-256 of the path, truncated to 16 hex chars).

### R2 — Editor binding

- **R2.1** The CM6 `EditorState` is created from the `Y.Text` in the note's `Y.Doc` via `y-codemirror.next`'s `yCollab` extension.
- **R2.2** Every keystroke in CM6 produces a Yjs operation on `Y.Text`. There is no separate "save content" path — the CRDT is the editor's state.
- **R2.3** Undo/redo uses Yjs `UndoManager` scoped to the local client, replacing CM6's built-in history.
- **R2.4** The binding must preserve all existing CM6 extensions (live preview decorations, wikilink completions, slash commands, search).
- **R2.5** When Yjs is disabled in settings, the editor falls back to the current direct CM6 state (no Y.Doc). This is the default until the user opts in.

### R3 — Local persistence provider

- **R3.1** A custom `DiskProvider` persists the `Y.Doc` to `.cork/crdt/<note-hash>.yjs` using Yjs binary encoding.
- **R3.2** The provider writes on a debounced interval (default 1 second) and on note close / app quit.
- **R3.3** Corrupt or unreadable `.yjs` files are moved to `.cork/crdt/corrupt/` and the doc is rebuilt from the `.md` file with a warning toast.
- **R3.4** `.cork/crdt/` is included in `.gitignore` by default. Users who want CRDT state in git can remove the ignore entry.

### R4 — Markdown flush

- **R4.1** A `FlushService` periodically (default 5 seconds, configurable) reads `Y.Text.toString()` and writes the result to the note's `.md` file on disk.
- **R4.2** Flush also runs on note close, app quit, and before any git sync operation.
- **R4.3** The flush is one-directional: CRDT → `.md`. External edits to the `.md` (detected by the file watcher) trigger a CRDT merge: the external content is applied as a remote update to the `Y.Doc`, preserving both the external changes and any concurrent local edits.
- **R4.4** Frontmatter in the `.md` file is kept in sync with `Y.Map("meta")`. Changes in either direction merge without conflict.
- **R4.5** The existing `notes.save` IPC command is refactored to call `FlushService.flush(noteId)` when CRDT is enabled, preserving the same external API for non-CRDT callers.

### R5 — WebSocket relay provider

- **R5.1** A `RelayProvider` wraps `y-websocket`'s `WebsocketProvider`, connecting the note's `Y.Doc` to a configurable relay URL.
- **R5.2** The relay URL and shared secret are configured per-vault in Settings → Sync → Real-time relay.
- **R5.3** Connection lifecycle: connect when a note is opened and relay is enabled; disconnect on note close. Reconnect with exponential backoff (1s → 2s → 4s → 30s cap).
- **R5.4** Auth: the client sends a `vault-id + HMAC(shared-secret, vault-id)` handshake. The relay validates before allowing room join.
- **R5.5** Each note maps to a relay "room" named `<vault-id>/<note-hash>`.
- **R5.6** Awareness protocol is enabled: each connected client publishes `{ clientId, name, color, cursor }`. The editor renders remote cursors and a presence bar.

### R6 — WebRTC provider (LAN/P2P)

- **R6.1** A `P2PProvider` wraps `y-webrtc`, enabling direct device-to-device sync without a relay server.
- **R6.2** Signaling uses a configurable signaling server URL (default: a public `y-webrtc` signaling server, overridable to self-hosted).
- **R6.3** WebRTC is enabled per-vault in Settings → Sync → LAN sync. Default off.
- **R6.4** Room naming follows the same `<vault-id>/<note-hash>` convention as R5.5.
- **R6.5** Awareness protocol is shared with the relay provider — cursors and presence work identically regardless of transport.

### R7 — Relay server

- **R7.1** Cork ships a standalone relay server as a separate package/binary (`cork-relay`).
- **R7.2** The relay is a `y-websocket` server (~200 lines) with HMAC auth validation.
- **R7.3** Optional persistence: if a `--persist` flag is set, the relay stores Y.Doc snapshots in a LevelDB/SQLite directory so that devices connecting after others have disconnected can catch up.
- **R7.4** The relay is stateless by default (broadcast only, no storage).
- **R7.5** Deployable as: Docker image, single binary (Node or Bun), Cloudflare Worker (stateless mode only).
- **R7.6** The relay handles no business logic — no note parsing, no user management, no git. It is a dumb pipe for Yjs updates.

### R8 — Settings integration

- **R8.1** Settings → Sync gains a new "Real-time sync" section with:
  - Toggle: Enable CRDT (default off — opt-in)
  - Relay URL input (shown when CRDT is on)
  - Shared secret input (shown when relay URL is set)
  - Toggle: LAN sync via WebRTC (default off)
  - Flush interval slider (1–30 seconds, default 5)
- **R8.2** Settings are per-vault (stored in `<vault>/.cork/config.json`).
- **R8.3** Changing the CRDT toggle triggers a one-time migration: enable → bootstrap `.yjs` from all `.md` files; disable → final flush all CRDTs → `.md`, remove `.cork/crdt/`.
- **R8.4** Command palette exposes: "Toggle real-time sync", "Connect relay", "Disconnect relay".

### R9 — Git interop

- **R9.1** The existing F26 git sync flow is unchanged. Before a git commit, `FlushService.flushAll()` ensures all `.md` files reflect the latest CRDT state.
- **R9.2** On `git pull`, any updated `.md` files trigger a CRDT merge (R4.3) for currently open notes. Closed notes simply get their `.yjs` rebuilt on next open.
- **R9.3** `.cork/crdt/` can optionally be committed to git (user removes the `.gitignore` entry). This preserves operation history across devices but increases repo size.
- **R9.4** Conflict-as-copy (F26's existing strategy) still applies at the git level, but should be extremely rare because CRDT flush produces deterministic output from merged state.

## Out of scope (deferred)

- Hosted/managed relay service (product decision, not a technical feature)
- End-to-end encryption of CRDT updates (relay sees plaintext Yjs binary; encryption is a future layer)
- Multi-user collaboration (F37 is multi-device for the same user; different users sharing a vault is future)
- Mobile sync (requires a mobile app first)
- Relay admin dashboard / monitoring
- CRDT-based frontmatter conflict resolution for structured fields beyond `Y.Map` (e.g., array merge for tags is basic; complex schemas deferred)

## Acceptance criteria

- `pnpm typecheck` and `pnpm lint` pass with zero warnings
- `pnpm test` passes — new unit tests for CrdtDocManager, DiskProvider, FlushService, provider lifecycle
- `cargo test --lib` passes — Rust-side flush interop tests
- Manual smoke: open a note, type, verify `.yjs` is created in `.cork/crdt/`, verify `.md` is flushed after interval
- Manual smoke: open same vault on two browser tabs connected to a local relay, type on one, see changes on the other within 200ms
- Manual smoke: disable CRDT in settings, verify editor falls back to direct CM6 state, verify `.cork/crdt/` is cleaned up
- Manual smoke: delete a `.yjs` file, reopen the note, verify it bootstraps from `.md` without data loss
- Manual smoke: git pull with external changes to an open note, verify CRDT merge applies cleanly
- E2E: two-client relay sync test using Playwright + local `cork-relay` instance

## Dependencies / assumptions

- **Yjs ecosystem:** `yjs`, `y-codemirror.next`, `y-websocket`, `y-webrtc`, `y-protocols` — all MIT licensed, actively maintained
- **CM6 compatibility:** `y-codemirror.next` must work with the current CM6 version (6.x) and not conflict with existing extensions
- **F26 git sync:** must be stable and working (it is — COMPLETE)
- **F05 editor:** the CM6 setup must be refactorable to accept an external `Y.Text` as state source
- **Node/Bun runtime:** the relay server requires a JS runtime (not bundled in the Tauri app)
- **Network:** relay requires outbound WebSocket; WebRTC requires UDP traversal (STUN/TURN)

## Status

PLANNED — target milestone M11.
