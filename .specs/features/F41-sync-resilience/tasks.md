# F41 — Sync Resilience Tasks

No automated tests (project decision). Verify = `pnpm typecheck && pnpm lint && cargo check` + manual UAT (revoked-token simulation, airplane mode).

## Phase 1 — Stop the bleeding

### F41-T01 — Erase-proof credential helper + empty-file detection (SYNC-01, SYNC-02)

- **What:** Replace `store --file` helper with the inline read-only helper; credential file in protocol format, written atomically (0600). Migration on vault open/enable from old format; empty/missing file → auth-error "token missing".
- **Where:** `src-tauri/src/vcs/remote.rs` (`configure_https_auth`, `clear_https_auth`, vault-open reconfigure path)
- **Done when:** `git push` with a revoked token fails BUT the credential file keeps its bytes; empty file surfaces "token missing" in `RemoteInfo.lastError`.
- **Commit:** `fix(sync): erase-proof credential helper — 401 can no longer wipe the token`

### F41-T02 [P] — Move sync log to app_log_dir + de-noise (SYNC-08)

- **What:** `append_log` targets `<app_log_dir>/sync.log` (F35 location, keep 1 MiB rotation); legacy `<vault>/.cork/sync.log` deleted once on worker start; drop routine `[pull] fetch` lines (log errors/merges/pushes/lifecycle events only); redact every line via the F35 redactor.
- **Where:** `src-tauri/src/vcs/remote.rs`, `src-tauri/src/diagnostics.rs` (redactor reuse)
- **Done when:** Zero heartbeat commits with the app idle; log file appears in app_log_dir with meaningful lines only; legacy vault log removed by one final commit.
- **Commit:** `fix(sync): move sync log out of the vault (kills 12s self-commit loop)`

## Phase 2 — Recovery UX

### F41-T03 — `vcs.updateToken` IPC + Update-token UI (SYNC-03)

- **What:** New command rewriting only the credential file + immediate `sync_now` validation; IpcContract entry same commit. "Update token" row in `GitHubSyncSection` connected state; auth-error banner links to it.
- **Where:** `src-tauri/src/vcs/remote.rs`, `src-tauri/src/lib.rs`, `src/ipc/IpcContract.ts`, `src/ipc/types.ts`, `src/stores/syncStore.ts`, `src/components/sync/GitHubSyncSection.tsx`
- **Depends on:** F41-T01
- **Done when:** Expired-token recovery = paste token → next heartbeat green; URL/history untouched.
- **Commit:** `feat(sync): update token in place without re-setup`

### F41-T04 — Error classification, offline state, backoff, fetch logging (SYNC-04/05/06)

- **What:** `error_kind` in `RemoteInner`/`RemoteInfo` (+contract); indicator states: network → "Offline — will retry" (calm), auth → actionable copy; heartbeat exponential backoff (12s→300s cap, reset on success, saves punch through); `[pull] error:` logging with redaction.
- **Where:** `src-tauri/src/vcs/remote.rs`, `src/ipc/*`, `src/components/sync/SyncIndicator.tsx`, `src/components/sync/GitHubSyncSection.tsx`
- **Depends on:** F41-T01
- **Commit:** `feat(sync): classify sync errors, offline state, heartbeat backoff`

## Phase 3 — Expiry awareness + close-out

### F41-T05 — Token expiry capture + warnings (SYNC-07) — P3, optional

_Deprioritized: incident token had no expiry. Ship T01–T04 first; do this only if the milestone still has appetite._

- **What:** On enable/updateToken, `curl -sI` (token via stdin) to `api.github.com/rate_limit`; parse `github-authentication-token-expiration`; persist `token_expires_at` in vault settings (metadata only). Indicator/Settings warn at ≤7 days; auth-error copy cites the date when past.
- **Where:** `src-tauri/src/vcs/remote.rs`, `src-tauri/src/vault/settings.rs`, `src/ipc/types.ts`, sync UI components
- **Depends on:** F41-T03
- **Commit:** `feat(sync): token expiry detection and pre-expiry warning`

### F41-T06 — Docs close-out

- **What:** ROADMAP F41 → COMPLETE; STATE quick-task row; lesson L-NNN on git credential-store erase semantics.
- **Commit:** `docs(specs): close out F41 sync resilience`

## Traceability

| Req     | Tasks |
| ------- | ----- |
| SYNC-01 | T01   |
| SYNC-02 | T01   |
| SYNC-03 | T03   |
| SYNC-04 | T04   |
| SYNC-05 | T04   |
| SYNC-06 | T04   |
| SYNC-07 | T05   |
| SYNC-08 | T02   |
