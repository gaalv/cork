# F26 – GitHub Sync (D2 v1)

## Overview

Lift F18's per-vault local git repo into a private GitHub repo so a single user can sync their vault between devices (typical: personal + work). Auto-push after every F18 auto-commit, periodic pull, conservative conflict handling that **never loses data**, and a visible sync status indicator while syncing is enabled.

Real-time multi-user editing remains deferred (see DEFERRED.md § D2 v2+).

## Decisions (locked)

- **Auth (Q1):** Delegate to `gh` CLI (`gh auth login` is the user's responsibility). Devs have it; it owns token storage/refresh; we never touch OAuth scopes ourselves. **Safer + simpler.**
- **Conflict (Q3):** "Best-effort 3-way merge, conflict-as-copy fallback." Try `git pull --no-rebase` (default merge — git 3-way handles most markdown line edits cleanly). If conflicts remain: abort merge, copy each remote conflicted file as `<base> (conflict from <host> <ISO>).md`, keep local as canonical, commit, push. **No `<<<<<<<` markers ever surface.**
- **Pull cadence (Q4):** On vault open + every 12 s while sync is enabled (timer-based; coalesces). Plus a manual "Sync now" command.
- **`.noxe/` (Q6):** Tracked. Settings + todos travel between devices. Excluded: `.noxe/sync.log` (rolling, device-specific) and `.noxe/cache/` (already excluded by F18).

## Requirements

### R1 – Remote enablement

- **R1.1** Vault setting `gitRemote: { enabled: boolean; url?: string; provider: "github" }`. Default `{ enabled: false, provider: "github" }`. Persisted via existing `settings.vaultSave`.
- **R1.2** IPC `vcs.remote.enable({ url? })`:
  - If `url` omitted: invoke `gh auth status` (must succeed) → `gh repo create --private --source . --remote origin --push <auto-name>`.
  - If `url` given: `git remote add/set-url origin <url>` then `git push -u origin main`.
  - On success persist `{ enabled: true, url }`.
- **R1.3** IPC `vcs.remote.disable()`: removes `origin`, sets `gitRemote.enabled = false`. Does NOT delete the GitHub repo.

### R2 – Auto-push

- **R2.1** After every F18 commit, schedule a push. Debounce 5 s; coalesces while a push is in flight (final push catches all queued commits).
- **R2.2** On push failure, capture stderr in `lastError`, transition status to `error`. Subsequent identical errors do NOT spam toasts (toast on transition only).

### R3 – Auto-pull

- **R3.1** On vault open with `gitRemote.enabled = true`: best-effort pull.
- **R3.2** Heartbeat: every 12 s, if remote enabled and not currently syncing, fetch + pull-merge.
- **R3.3** Manual "Sync now" command (palette + tray) forces a pull-then-push immediately.
- **R3.4** Conflict resolution per Q3 decision: 3-way merge first, conflict-as-copy fallback.

### R4 – Status surface

- **R4.1** `vcs.status` extended:
  ```ts
  { enabled, repoPath, hasGit, hasGh, remote?: {
      enabled, url?, syncStatus: "idle"|"syncing"|"error"|"offline",
      lastPush?: ISO, lastPull?: ISO, lastError?: string
  }}
  ```
- **R4.2** Frontend Zustand store `useSyncStore` polls `vcs.status` every 5 s while a vault is open.
- **R4.3** TopBar shows a small icon (only when `remote.enabled = true`):
  - `idle` → subtle green check
  - `syncing` → spinner
  - `error` → orange warning (tooltip = `lastError`)
  - `offline` → grey cloud-off (when network unavailable, optional v0)
  - Click → opens Settings → GitHub sync.

### R5 – Settings UI

- **R5.1** Settings → Files & Vaults → "GitHub sync" subsection:
  - Enable toggle.
  - When enabling on a fresh vault: dialog with two paths:
    - "Create new private repo" (uses `gh`).
    - "Use existing URL" (`git@github.com:...` or `https://...`).
  - Shows: URL, last push (relative), last pull, last error (red text if any), and a "Sync now" button.
  - "Disable sync" button.

### R6 – Conflict-as-copy implementation

- **R6.1** Wrapped in a single function `pull_with_conflict_copy(vault_root)`:
  1. `git fetch origin`
  2. `git merge --no-edit --no-ff origin/main` (or current upstream).
  3. If success → done.
  4. If exit non-zero with conflicts: list conflicted paths via `git diff --name-only --diff-filter=U`.
  5. For each: read `:3:<path>` (theirs) into `<base> (conflict from <hostname> <utc-iso>).<ext>`; `git checkout --ours -- <path>`; `git add <path> <conflict-copy>`.
  6. `git commit -m "Merge remote: kept local, saved remote conflicts as copies"`.
  7. Schedule a push.

### R7 – `.gitignore` update

- **R7.1** F18's gitignore writer now produces:
  ```
  .DS_Store
  node_modules/
  dist/
  .noxe/cache/
  .noxe/sync.log
  ```
  (Removes the previous `.noxe/cache/`-only entry and adds `sync.log`.) Existing repos: when F26 enables remote, append the `.noxe/sync.log` line if missing.

### R8 – Telemetry

- **R8.1** Push / pull stdout+stderr appended to `.noxe/sync.log` (rolling, capped 1 MB).

## Out of scope (still deferred)

- Real-time CRDT (D2 v2+).
- 3-way merge UI.
- Git LFS / binary-aware sync (assets > 50 MB warned + skipped from auto-add via gitignore TODO).
- Provider plurality.
- Mobile.

## Acceptance criteria

- `cargo test --lib` ✓ (existing 132 + new vcs::remote tests)
- `pnpm typecheck` ✓ / `pnpm lint` ✓ / `pnpm vitest run` ✓
- Toggling sync ON in Settings on a fresh vault provisions a private repo and pushes the initial commit (manual smoke).
- Heartbeat pull + auto-push observable in `.noxe/sync.log`.
- Forced offline divergence on two devices → after both reconnect, both versions exist (one as the conflict-copy file).
- TopBar indicator matches state transitions.

## Dependencies / assumptions

- F18 vcs module foundation reused.
- User has `git` and `gh` installed and `gh auth login` completed.
- macOS/Linux focus. Windows path quirks deferred (gh works on Windows too — should be fine but not validated).
