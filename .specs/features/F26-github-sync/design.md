# F26 – Design

## Architecture

```
┌─ Frontend ──────────────────────────────┐
│  TopBar SyncIndicator ◄── useSyncStore  │
│  Settings GitHubSyncSection              │
│  Palette/Tray "Sync now"                 │
│           │ IPC                           │
└───────────┼─────────────────────────────┘
            ▼
┌─ Rust src-tauri/src/vcs/ ───────────────┐
│  mod.rs           — F18 (existing)       │
│  remote.rs        — F26 (NEW)            │
│   ├ RemoteState   (Arc<Mutex<…>>)        │
│   ├ commands       enable/disable/sync_now│
│   ├ pull_with_conflict_copy              │
│   ├ push_debounced                        │
│   └ heartbeat worker (12 s tick)         │
└──────────────────────────────────────────┘
```

## Key types

```rust
// remote.rs
pub enum SyncStatus { Idle, Syncing, Error }

pub struct RemoteState {
    enabled: AtomicBool,
    inner: Arc<Mutex<RemoteInner>>,
}

struct RemoteInner {
    status: SyncStatus,
    last_push: Option<DateTime<Utc>>,
    last_pull: Option<DateTime<Utc>>,
    last_error: Option<String>,
    push_pending: bool,
    in_flight: bool,
}
```

`VcsStatus` extended to include `has_gh: bool` and `remote: Option<RemoteInfo>`.

## Workers

Two background threads, both spawned at app setup (next to F18's commit worker):

1. **Push worker.** Wakes when `push_pending` flips true OR every 1 s; if `enabled && push_pending && !in_flight && elapsed >= 5 s` → run `git push origin <branch>`; record result.
2. **Heartbeat worker.** Every 12 s: if `enabled && !in_flight` → `pull_with_conflict_copy(vault_root)`; if anything was actually merged or new commits exist locally, set `push_pending = true` so push worker handles it.

Both workers share `RemoteState` via `Arc`. Mutex held only for short status updates — never across `Command::output()` calls (use a local clone of vault_root + drop the lock first).

## Conflict-as-copy algorithm

```rust
fn pull_with_conflict_copy(vault_root: &Path) -> Result<PullOutcome, String> {
    run("git fetch origin");
    let merge_res = run("git merge --no-edit --no-ff origin/main");
    if merge_res.success { return Ok(PullOutcome::Merged); }

    let conflicted = run("git diff --name-only --diff-filter=U")
        .lines().map(PathBuf::from).collect();
    for path in &conflicted {
        let theirs = run(format!("git show :3:{}", path));
        let copy_name = format!("{stem} (conflict from {host} {iso}).{ext}");
        std::fs::write(vault_root.join(&copy_name), theirs)?;
        run(format!("git checkout --ours -- {}", path));
        run(format!("git add {} {}", path, copy_name));
    }
    run("git commit -m \"Merge remote: kept local, saved remote conflicts as copies\"");
    Ok(PullOutcome::ConflictCopied(conflicted))
}
```

## Hooks into F18

- `do_commit` (F18) extended to call `RemoteState::mark_push_pending()` when push is enabled.
- `git_init_if_needed` (F18) updated `.gitignore` content per R7.
- `vcs_status` extended to include remote info via `RemoteState::snapshot()`.

## Frontend

- `useSyncStore` (zustand): polls `client.vcs.status()` every 5 s while a vault is open. Emits state for indicator.
- `<SyncIndicator />` in TopBar between AI button and command-palette button.
- `<GitHubSyncSection />` in Settings panel — uses existing `vaultSettingsStore` for the toggle, calls `client.vcs.remoteEnable/Disable/SyncNow`.
- New palette command `sync-now`.

## Test strategy

- Rust unit tests:
  - `pull_with_conflict_copy` over a synthetic local repo (two clones + induced conflict). Marked `#[ignore]` if `git` not on PATH.
  - `RemoteState` snapshot/transition logic (no IO).
  - `.gitignore` writer produces the new entries.
- Frontend store test: mocks IPC, asserts polling + state transitions on status payloads.
- Manual smoke for `gh repo create` (network).
