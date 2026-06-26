# F37 — CRDT Sync Tasks

```
Foundation:  T01 -> T02 -> T03 -> T04 -> T05
Editor:      T05 -> T06 -> T07
Flush:       T07 -> T08 -> T09
Relay:       T09 -> T10 -> T11 -> T12
P2P:         T12 -> T13
Settings:    T14 (parallel with T06+)
Git interop: T09 -> T15
Server:      T16 -> T17
E2E:         T17 -> T18
```

---

## Foundation

### T01: Add Yjs dependencies
**Where:** `package.json`
**What:** Install `yjs`, `y-codemirror.next`, `y-websocket`, `y-webrtc`, `y-protocols`, `lib0`. Pin versions.
**Requirement:** R1.1, R2.1, R5.1, R6.1
**Commit:** `feat(crdt): add Yjs ecosystem dependencies`

### T02: Create Rust CRDT binary I/O module
**Where:** `src-tauri/src/crdt/mod.rs`, `src-tauri/src/crdt/paths.rs`
**What:** Implement `CrdtPaths` struct, `crdt.read_snapshot`, `crdt.write_snapshot`, `crdt.delete_snapshot`, `crdt.list_snapshots`, `crdt.recover_corrupt`, `crdt.cleanup` IPC commands. Register in `lib.rs`. Update `IpcContract.ts`.
**Requirement:** R1.4, R1.5, R1.6, R3.3
**Commit:** `feat(crdt): Rust CRDT binary I/O commands`

### T03: Create CrdtDocManager service
**Where:** `src/features/crdt/services/CrdtDocManager.ts`
**What:** Implement the core manager: `openNote()` (load snapshot or bootstrap from .md), `closeNote()` (flush + persist + destroy), `getDoc()`, `getNoteHash()`. Lazy loading — only open notes in memory.
**Depends on:** T02
**Requirement:** R1.1, R1.2, R1.3, R1.4, R1.5, R1.6
**Commit:** `feat(crdt): CrdtDocManager with open/close lifecycle`

### T04: Create DiskProvider
**Where:** `src/features/crdt/providers/DiskProvider.ts`
**What:** Custom Yjs provider that persists Y.Doc to `.cork/crdt/<hash>.yjs` via Rust IPC. Debounced 1s write on `doc.on('update')`. Persist on disconnect. Handle corrupt files (move to `corrupt/`, rebuild from .md).
**Depends on:** T03
**Requirement:** R3.1, R3.2, R3.3, R3.4
**Commit:** `feat(crdt): DiskProvider for local CRDT persistence`

### T05: Unit tests for foundation layer
**Where:** `src/features/crdt/services/CrdtDocManager.test.ts`, `src/features/crdt/providers/DiskProvider.test.ts`, `src-tauri/src/crdt/mod.rs` (Rust tests)
**What:** Test open/close lifecycle, bootstrap from .md, load from snapshot, corrupt recovery, hash derivation. Rust tests for binary round-trip and cleanup.
**Depends on:** T04
**Done when:** `pnpm test` and `cargo test --lib` pass with new tests
**Commit:** `test(crdt): CrdtDocManager + DiskProvider + Rust I/O tests`

---

## Editor binding

### T06: Bind CM6 to Y.Text via y-codemirror.next
**Where:** `src/features/editor/hooks/useEditorExtensions.ts`, `src/features/editor/services/editorSetup.ts`
**What:** When CRDT is enabled for the current note, replace CM6's direct `EditorState.create({ doc })` with `yCollab(ytext, awareness)` extension. Replace CM6 undo history with Yjs `UndoManager`. Ensure all existing extensions (live preview, wikilinks, slash commands, search) remain functional.
**Depends on:** T05
**Requirement:** R2.1, R2.2, R2.3, R2.4
**Commit:** `feat(crdt): bind CM6 editor to Y.Text via yCollab`

### T07: Editor fallback when CRDT is disabled
**Where:** `src/features/editor/hooks/useEditorExtensions.ts`
**What:** When `sync.crdt.enabled` is false (default), editor uses the existing direct CM6 state path. No Y.Doc, no providers. The toggle is read from vault settings at note-open time.
**Depends on:** T06
**Requirement:** R2.5
**Commit:** `feat(crdt): editor fallback to direct CM6 when CRDT off`

---

## Flush & external change

### T08: Create FlushService
**Where:** `src/features/crdt/services/FlushService.ts`
**What:** Implement `flush(noteId)` — read Y.Text + Y.Map, serialize frontmatter + body, call `notes.save`. Implement `flushAll()` for git sync and app quit. Start/stop flush timer per note (configurable interval, default 5s). Track dirty state per doc.
**Depends on:** T07
**Requirement:** R4.1, R4.2, R4.4, R4.5
**Commit:** `feat(crdt): FlushService for periodic CRDT-to-markdown writes`

### T09: Handle external .md changes via CRDT merge
**Where:** `src/features/crdt/services/FlushService.ts`, `src/features/editor/hooks/useExternalReconciler.ts`
**What:** When the file watcher detects a `.md` change for an open CRDT-enabled note, apply the external content as a remote Yjs transaction instead of reloading the editor. Preserves concurrent local edits. Refactor `useExternalReconciler` to delegate to FlushService when CRDT is active.
**Depends on:** T08
**Requirement:** R4.3
**Commit:** `feat(crdt): merge external .md changes into Y.Doc`

---

## Relay provider

### T10: Create RelayProvider
**Where:** `src/features/crdt/providers/RelayProvider.ts`
**What:** Wrap `y-websocket`'s `WebsocketProvider`. Connect on note open when relay is configured. Disconnect on note close. Exponential backoff reconnect (1s → 30s cap). Pass auth token as URL param.
**Depends on:** T09
**Requirement:** R5.1, R5.2, R5.3, R5.4, R5.5
**Commit:** `feat(crdt): RelayProvider wrapping y-websocket`

### T11: Awareness protocol + remote cursors
**Where:** `src/features/crdt/services/AwarenessService.ts`, `src/features/editor/hooks/useEditorExtensions.ts`
**What:** Share `Awareness` instance across providers. Publish local user state (name, color, cursor). Add `yRemoteSelections` + `yRemoteSelectionsTheme` CM6 extensions. Render presence bar above the editor showing connected clients.
**Depends on:** T10
**Requirement:** R5.6, R6.5
**Commit:** `feat(crdt): awareness protocol + remote cursor rendering`

### T12: Unit + integration tests for relay flow
**Where:** `src/features/crdt/providers/RelayProvider.test.ts`, `src/features/crdt/services/AwarenessService.test.ts`
**What:** Test connect/disconnect lifecycle, reconnect backoff, auth rejection. Integration: two Y.Doc instances connected via in-memory relay, verify concurrent edits merge.
**Depends on:** T11
**Done when:** `pnpm test` passes with new tests
**Commit:** `test(crdt): RelayProvider + awareness integration tests`

---

## P2P provider

### T13: Create P2PProvider
**Where:** `src/features/crdt/providers/P2PProvider.ts`
**What:** Wrap `y-webrtc`. Connect on note open when LAN sync is enabled. Share awareness with relay provider. Configurable signaling server URL.
**Depends on:** T12
**Requirement:** R6.1, R6.2, R6.3, R6.4, R6.5
**Commit:** `feat(crdt): P2PProvider wrapping y-webrtc for LAN sync`

---

## Settings

### T14: Settings UI for CRDT sync
**Where:** `src/features/settings/ui/SyncSection.tsx`, `src/features/settings/state/appSettingsStore.ts`, vault config schema
**What:** Add Settings → Sync section with: CRDT toggle, relay URL, shared secret, LAN sync toggle, flush interval slider, display name. Store per-vault in `.cork/config.json`. Implement enable/disable migration (R8.3): enable → bootstrap .yjs for all notes; disable → flushAll + cleanup.
**Requirement:** R8.1, R8.2, R8.3, R8.4
**Commit:** `feat(crdt): Settings → Sync section + enable/disable migration`

---

## Git interop

### T15: Wire FlushService into F26 git sync
**Where:** `src/features/vault/services/gitSyncService.ts` (or equivalent F26 sync trigger)
**What:** Before any git commit operation, call `FlushService.flushAll()` to ensure all `.md` files reflect latest CRDT state. On git pull, trigger `onExternalChange` for any updated `.md` files that are currently open. Add `.cork/crdt/` to the vault's `.gitignore` during scaffold (F30).
**Depends on:** T09
**Requirement:** R9.1, R9.2, R9.3, R9.4
**Commit:** `feat(crdt): wire FlushService into git sync lifecycle`

---

## Relay server

### T16: Scaffold cork-relay package
**Where:** `packages/cork-relay/`
**What:** Create standalone package with `y-websocket` server, HMAC auth validation middleware, optional LevelDB persistence (`--persist` flag). Add `Dockerfile`, `package.json` with `start` script. ~200 lines total.
**Requirement:** R7.1, R7.2, R7.3, R7.4, R7.5, R7.6
**Commit:** `feat(relay): scaffold cork-relay y-websocket server`

### T17: Relay server tests + Docker build
**Where:** `packages/cork-relay/src/server.test.ts`, `packages/cork-relay/Dockerfile`
**What:** Test: valid HMAC connects, invalid HMAC rejects (4001), room isolation (updates don't leak between rooms), persistence round-trip (when enabled). Verify Docker image builds and starts.
**Depends on:** T16
**Done when:** `pnpm --filter cork-relay test` passes, `docker build` succeeds
**Commit:** `test(relay): auth + room isolation + persistence tests`

---

## E2E

### T18: Two-client relay sync E2E
**Where:** `tests/e2e/crdt-sync.spec.ts`
**What:** Start local `cork-relay` as a test fixture. Open the same vault in two Playwright browser contexts connected to the relay. Type in context A → assert text appears in context B within 500ms. Disconnect relay → type in both → reconnect → assert clean merge. Verify remote cursor rendering.
**Depends on:** T17
**Done when:** `pnpm test:e2e` passes with new spec
**Commit:** `test(e2e): two-client CRDT relay sync`
