# F41 — Sync Resilience Specification

## Problem Statement (root cause, diagnosed 2026-07-07 from the live vault)

GitHub sync died and forced a full re-setup with a new token. Evidence from `~/second-brain`:

1. `23:55:43Z` push ok → `23:55:55Z` push fails **HTTP 401** → `.git/cork-credentials` becomes **0 bytes** (mtime matches to the minute, atomic rewrite, no stale `.lock`). Git's `credential-store` helper **erases** a credential the server rejects — one single 401 permanently destroyed a valid PAT.
2. The 401 was **transient — the token had no expiration** (user-confirmed) and this is a personal machine (no corporate proxy). The exact server-side reason for that one 401 is not determinable from client logs (GitHub auth hiccup or sleep-transition network churn — `pmset` shows the machine cycling Maintenance-Sleep/DarkWake around the incident). What made hitting a transient 401 near-inevitable is defect #4.
3. After the failure, the heartbeat hammers a broken fetch every 12s **silently** — fetch errors are never logged and the UI has no actionable recovery; the only path back is disconnect + full re-setup.
4. **Amplifier + repo-bloat defect:** `.cork/sync.log` is swept into commits, so every heartbeat commits the log's own growth and pushes — a push to GitHub every ~12s while the app runs. Started 2026-06-29 (the real-time-sync-status change); the vault now carries **5,848** `sync(single): update .cork/sync.log` commits (3,437 on 06-30 alone). At that request volume, an occasional transient 401 is a statistical certainty — and with `credential-store` erase semantics, the first one kills sync.

## Goals

- [ ] A 401 (transient or expiry) can never delete the stored token
- [ ] Recovering from an expired token = paste new token in one field ("Update token") — remote, URL, and history untouched
- [ ] The app knows the token's expiry date and warns before it hits
- [ ] Offline/transient errors and auth errors are distinguishable in the UI; neither hammers GitHub every 12s indefinitely
- [ ] The sync log stops committing itself

## Out of Scope

| Feature                               | Reason                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| OAuth device flow / gh re-integration | AD-051 locked repo-scoped PAT; this feature makes PAT livable       |
| OS keychain storage for the PAT       | Planned for F38's `keyring` integration; file storage stays for now |
| Auto-renewing tokens                  | GitHub doesn't allow it for fine-grained PATs                       |

---

## User Stories

### P1: Token survives auth failures ⭐ MVP

**Acceptance Criteria**:

1. WHEN GitHub returns 401/403 on any git operation THEN the stored credential file SHALL remain intact (erase-proof helper)
2. WHEN the credential file is present but empty (today's corrupted state) THEN the UI SHALL report "token missing" as an auth error with the Update-token affordance, not a generic sync error

### P1: Update token in place ⭐ MVP

**Acceptance Criteria**:

1. WHEN sync is connected (or in auth-error state) THEN Settings → Sync SHALL offer "Update token": one password field + confirm, rewriting only the credential file
2. WHEN the new token works THEN sync SHALL resume on the next heartbeat without touching remote config, URL, or git history

### P1: Error classification + backoff ⭐ MVP

**Acceptance Criteria**:

1. WHEN a sync op fails THEN backend SHALL classify the error: `auth` (401/403/permission), `network` (resolve/connect/timeout), `other`, and expose it in `RemoteInfo`
2. WHEN the error is `network` THEN the indicator SHALL show a calm "Offline — will retry" state (not the red error state)
3. WHEN the error is `auth` THEN the indicator/Settings SHALL say the token is invalid or expired (with expiry date when known) and link to Update token
4. WHEN failures repeat consecutively THEN the heartbeat SHALL back off (12s → 60s → 300s cap) and reset on success
5. WHEN fetch/pull fails THEN the failure SHALL be logged to `sync.log` (today it is silent)

### P3: Expiry awareness

_Deprioritized: the incident token had no expiry — this protects only users who mint expiring PATs. Cheap, but last._

**Acceptance Criteria**:

1. WHEN a token is saved (enable or update) THEN system SHALL read GitHub's `github-authentication-token-expiration` response header (single HTTPS request to the already-configured GitHub API) and persist the expiry date (never the token) in vault settings
2. WHEN expiry is within 7 days THEN the sync indicator + Settings SHALL warn "Sync token expires in N days"
3. WHEN the expiry header is absent (classic PAT / no expiry) THEN nothing is shown

### P1: Sync log out of the vault ⭐ MVP

The log stays (it is the only reason this incident was diagnosable) but moves out of the repo and stops narrating routine heartbeats.

**Acceptance Criteria**:

1. WHEN sync logging writes THEN it SHALL target `<app_log_dir>/sync.log` (same location + rotation pattern as F35's `crashes.log`), never a path inside the vault — the self-commit loop becomes impossible by construction
2. WHEN a vault still contains a legacy `.cork/sync.log` THEN it SHALL be deleted once (the sweep commits the deletion — the last sync.log commit ever)
3. WHEN a heartbeat pull finds nothing (routine no-op) THEN nothing SHALL be logged; errors, merges, conflict-copies, pushes, and state transitions SHALL be logged
4. WHEN log lines are written THEN token-shaped strings SHALL be redacted (reuse the F35 redactor)

---

## Requirement Traceability

| Requirement ID | Story                                           | Status  |
| -------------- | ----------------------------------------------- | ------- |
| SYNC-01        | Erase-proof credential helper                   | Pending |
| SYNC-02        | Empty/missing credential surfaces as auth error | Pending |
| SYNC-03        | Update token in place (IPC + UI)                | Pending |
| SYNC-04        | Error classification in RemoteInfo              | Pending |
| SYNC-05        | Offline state UX + auth state UX                | Pending |
| SYNC-06        | Heartbeat backoff + fetch error logging         | Pending |
| SYNC-07        | Token expiry capture + warning                  | Pending |
| SYNC-08        | sync.log excluded from commits                  | Pending |

**Coverage:** 8 total, 8 mapped, 0 unmapped

---

## Success Criteria

- [ ] Simulated 401 (revoked token) leaves the credential file intact and shows "Update token"
- [ ] Recovery from expired token takes < 1 min and zero GitHub setup beyond minting the PAT
- [ ] Airplane-mode shows "Offline — will retry" and self-heals on reconnect
- [ ] Vault repo gains zero `sync.log` commits after the fix
