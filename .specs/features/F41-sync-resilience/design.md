# F41 — Sync Resilience Design

## 1. Erase-proof credential helper (SYNC-01/02)

Today: `credential.helper = store --file <vault>/.git/cork-credentials`. Git's `store` helper implements `erase` — a single 401 makes git reject the credential and wipe it from the file (verified live: 0-byte file, mtime = the 401 minute).

Fix: replace the helper with an inline read-only helper that answers `get` and ignores `store`/`erase`:

```
credential.helper = !f() { test "$1" = get && cat '<vault>/.git/cork-credentials'; }; f
```

- The file switches to credential-protocol format: `username=x-access-token\npassword=<token>\n` (written by us at enable/update; never rewritten by git).
- `configure_https_auth` writes this file atomically (temp + rename, 0600 perms).
- Migration: on enable/update the file is rewritten anyway. On vault open with the old `store --file` helper configured, reconfigure to the new inline helper and convert the URL-format line if the file still has one; if the file is empty (today's corrupted state) → set auth-error status "token missing" (SYNC-02).
- Windows note: helper runs under git's sh; quote the path defensively (`shell_single_quote` exists).

## 2. Update token in place (SYNC-03)

New IPC `vcs.updateToken { token }`:

- Validates like `configure_https_auth` (non-empty, no control chars), rewrites only the credential file, then fires an immediate `sync_now` to validate. Does NOT touch remote config, URL, vault settings, or history.
- On success: also refresh expiry metadata (§4). On 401 with the new token: report auth error, keep the file (no erase — helper guarantees it).
- UI: `GitHubSyncSection` connected-state gains an "Update token" row (password input + button); the auth-error banner deep-links to it.

## 3. Error classification + backoff (SYNC-04/05/06)

- `RemoteInner`/`RemoteInfo` gain `error_kind: Option<"auth" | "network" | "other">` (serde camelCase). Classification in `finish_op` from the error string: auth = `401|403|authentication failed|permission|invalid username or token`, network = `could not resolve|failed to connect|connection|timed out|unreachable|reset by peer`.
- `SyncStatus` gains `Offline` (or the indicator derives it from `error_kind == network`) — pick whichever keeps `SyncIndicator.tsx` simplest; copy: "Offline — will retry".
- Backoff: `consecutive_failures: u32` in `RemoteInner`; heartbeat sleeps `12s * min(2^failures, 25)` capped at 300s; reset on any success. `mark_push_pending` still works normally — a user save punches through immediately (only the idle heartbeat backs off).
- Logging: `pull_with_conflict_copy` fetch failures get an `append_log("[pull] error: …")` line (redacted via existing `redact_secret`).

## 4. Expiry awareness (SYNC-07)

- On enable/updateToken success: single HTTPS request `GET https://api.github.com/rate_limit` with `Authorization: Bearer <token>` (cheapest authenticated endpoint, no repo perms needed); read the `github-authentication-token-expiration` response header.
- Requires an HTTP client: prefer shelling `curl -sI` (matches the shell-out-to-git philosophy, zero new crate) with the token passed via `--header @-` on stdin (never argv). Parse the header from stdout.
- Persist `git_remote.token_expires_at: Option<String>` (ISO date — metadata, not a secret) in vault settings.
- UI: `SyncIndicator` + `GitHubSyncSection` show "Token expires in N days" when N ≤ 7; auth-error copy appends "(token expired on <date>)" when the stored date is past.
- Header absent → clear the field, show nothing. Request failure → non-fatal, skip.

## 5. Sync log out of the vault (SYNC-08)

Keep the log — it is what made this incident diagnosable — but fix location and volume:

- **Relocate:** `append_log` writes to `<app_log_dir>/sync.log` (the F35 `crashes.log` directory), keeping the existing 1 MiB size-based rotation. `RemoteInner` carries the resolved log path (app handle available at worker start). The loop becomes structurally impossible: the log is not in the repo.
- **Migrate:** on remote worker start, if `<vault>/.cork/sync.log` exists → delete it; the next sweep commits the deletion (final cleanup commit).
- **De-noise:** drop the unconditional `[pull] fetch` line (it fired every 12s). Log: pull errors, merges/conflict-copies, push start/ok/error, enable/disable/update-token events, error-kind transitions. Reuse the F35 redactor for every line (today only push errors redact, and only the token value).
- Multi-vault: prefix lines with a short vault identifier (basename) — single file keeps F35 parity.

## Ordering note

§1 + §5 are the highest-value/lowest-risk pieces and fix the observed incident directly; §2 unblocks painless recovery; §3–§4 are the polish that make failures legible. Tasks follow that order.
