# F18 – Local Git Sync: Design

## Architecture

```
Frontend (React/TS)               Rust (Tauri commands)
─────────────────────────────     ────────────────────────────────
vcs/services/vcsClient.ts    ←→   src-tauri/src/vcs/mod.rs
vcs/state/vcsStore.ts               ├── git_available()
vcs/ui/NoteHistory.tsx              ├── git_init_if_needed()
                                    ├── VcsState (debounce map)
NoteMetaPanel.tsx                   ├── vcs_status
  └── NoteHistory                   ├── vcs_history
                                    └── vcs_restore
settings/
  settingsTypes.ts (gitAutoCommit)
  vaultSettingsStore.ts
  settingsBridge.ts
  ui/SettingsPanel.tsx (toggle)
```

## Rust VCS module (`src-tauri/src/vcs/mod.rs`)

### State

```rust
pub struct VcsState {
    pending: Arc<Mutex<HashMap<PathBuf, PendingCommit>>>,
}
struct PendingCommit {
    queued_at: Instant,
    is_new: bool,
    vault_root: PathBuf,
}
```

Background worker (spawned once in `lib.rs::run()` setup block):
- Sleeps 1 s in a loop
- Picks entries where `now - queued_at >= 5 s`
- Calls `do_commit(vault_root, note_path, is_new)` for each

### Git helpers
- `git_available()` → `Command::new("git").arg("--version").output().is_ok()`
- `git_init_if_needed(root)` → init + .gitignore + initial commit
- `do_commit(root, path, is_new)` → `git add <file> && git commit -m "..."`

### IPC commands
| Command | Rust fn | Input | Output |
|---------|---------|-------|--------|
| `vcs.status` | `vcs_status` | - | `VcsStatus` |
| `vcs.history` | `vcs_history` | `{ note_path, limit? }` | `Vec<CommitEntry>` |
| `vcs.restore` | `vcs_restore` | `{ note_path, sha }` | `void` |

## Frontend VCS feature

### `vcs/services/vcsClient.ts`
Thin re-export of `client.vcs.*` with typed helpers.

### `vcs/state/vcsStore.ts`
Zustand store:
- `status: VcsStatus | null`
- `loadStatus()` – calls `client.vcs.status()`

### `vcs/ui/NoteHistory.tsx`
Props: `{ notePath: string | null, noteId: string | null }`

Behavior:
1. On `notePath` change → fetch `vcs.history`
2. Fetch `vcs.status` once on mount
3. Render commit list or placeholder
4. On "Restore" confirm → `vcs.restore` → `notes.read` → `openBuffer`

## Settings integration

### New field: `gitAutoCommit`
- **Type**: `boolean`, default `true`
- **Rust**: `vault/settings.rs → VaultSettings.git_auto_commit: Option<bool>`
- **TypeScript**: `VaultScopedSettings.gitAutoCommit?: boolean`
- **settingsBridge key**: `"vcs.gitAutoCommit"` (vault scope)
- **SettingsPanel**: toggle in "Files & Vaults" section

## Hooks into existing commands

### `vault_open` (and `setup`)
After `state.set_current_path(path)`:
```rust
if let Err(e) = crate::vcs::git_init_if_needed(&path) {
    eprintln!("noxe vcs: git init skipped: {e}");
}
```

### `notes_save`
After success, add `vcs_state: tauri::State<'_, VcsState>`:
```rust
if git_auto_commit_enabled(&state) {
    vcs_state.schedule(vault_root, result.path.clone(), false);
}
```

### `notes_create`
Same as above with `is_new = true`.

## Key design decisions

| Decision | Rationale |
|----------|-----------|
| Shell out to `git` CLI | Avoids `git2`/libgit2 dep; simpler, 0 extra Cargo deps |
| 5-second Rust-side debounce | Groups rapid saves; works regardless of frontend lifecycle |
| Background worker thread | Simple; no tokio overhead; VcsState is `Send + Sync` |
| No diff view (deferred) | Scope control; restore is enough for v0 |
| Vault-scoped setting | Users may want VCS per vault, not globally |
