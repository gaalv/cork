# F02 — Vault FS Tasks

**Design:** `.specs/features/F02-vault-fs/design.md`

## Phase plan

```
T01 → T02 → { T03[P], T04[P], T05[P] } → T06 → T07 → T08 → { T09[P], T10[P], T11[P] } → T12 → T13
```

---

### T01: Define IpcContract.ts (vault + notes namespaces)

**What:** Create `src/shared/ipc/IpcContract.ts` enumerating commands/events with TS types matching design.md.
**Where:** `src/shared/ipc/IpcContract.ts`, `src/shared/ipc/types.ts`
**Depends on:** F01 complete
**Requirement:** VAULT-01..17 (interface)
**Done when:** Types compile; no `any`.
**Commit:** `feat(ipc): define vault and notes contracts`

### T02: Add Rust deps + module skeleton

**What:** Add to `src-tauri/Cargo.toml`: `walkdir`, `notify = "6"`, `notify-debouncer-mini`, `serde_yaml`, `trash`, `sha1`. Create empty `src-tauri/src/vault/{mod,list,io,frontmatter,watcher,fingerprint}.rs`.
**Where:** `src-tauri/Cargo.toml`, `src-tauri/src/vault/`
**Depends on:** T01
**Requirement:** scaffolding
**Done when:** `cargo build` succeeds.
**Commit:** `chore(rust): add vault deps and module scaffold`

### T03: frontmatter.rs + tests [P]

**What:** Implement `parse(text) -> (Value, body)`. Handle missing frontmatter, malformed YAML (return Parse error), CRLF line endings.
**Where:** `src-tauri/src/vault/frontmatter.rs`
**Depends on:** T02
**Requirement:** VAULT-06
**Done when:** ≥ 6 tests pass (no FM, with FM, malformed, CRLF, empty body, only FM).
**Commit:** `feat(vault): yaml frontmatter parser`

### T04: list.rs + tests [P]

**What:** `list(root) -> Vec<NoteEntry>`. Walk skipping hidden, non-md, symlinks. Title resolution: first H1 in body, else filename stem. Path → ID via sha1.
**Where:** `src-tauri/src/vault/list.rs`, fixture vault under `src-tauri/tests/fixtures/`
**Depends on:** T02
**Requirement:** VAULT-04, VAULT-16
**Done when:** Test against fixture (10 files, 2 hidden, 1 symlink, 1 non-md) returns exactly 10 entries.
**Commit:** `feat(vault): list notes recursively`

### T05: fingerprint.rs + tests [P]

**What:** `FingerprintCache` with `record(path, size, mtime)`, `pop_recent(path) -> bool` (matches if entry < 2 s old and same size+mtime, then removes).
**Where:** `src-tauri/src/vault/fingerprint.rs`
**Depends on:** T02
**Requirement:** VAULT-12
**Done when:** Tests for hit, miss, expired, race.
**Commit:** `feat(vault): fingerprint cache for echo-loop mitigation`

### T06: io.rs — read + save + create + rename + trash

**What:** Implement all FS operations from design. `save_atomic` writes to temp file via `tempfile::NamedTempFile::new_in(dir)` then `persist`. After save, call `FingerprintCache::record`. Optimistic concurrency: if `expected_mtime` provided and on-disk mtime differs → return `Conflict`.
**Where:** `src-tauri/src/vault/io.rs`, plus `tempfile` dep
**Depends on:** T03, T05
**Requirement:** VAULT-07, VAULT-08, VAULT-13, VAULT-14, VAULT-15, VAULT-17
**Done when:** Integration test: write 100 files concurrently, assert all atomic and unique. Save with stale `expected_mtime` returns Conflict.
**Commit:** `feat(vault): atomic note io operations`

### T07: watcher.rs — debounced + echo-aware

**What:** Spawn watcher in a thread; receive debounced events; for each, lookup fingerprint; emit `vault.fileChanged` to the main window via Tauri's `Manager::emit_to`. `start()` and `stop()` are idempotent.
**Where:** `src-tauri/src/vault/watcher.rs`
**Depends on:** T05, T06
**Requirement:** VAULT-10, VAULT-11, VAULT-12
**Done when:** Test (with `tempdir`): touching 50 files in burst → ≤ 50 events; saving via io.rs → 0 external events.
**Commit:** `feat(vault): debounced filesystem watcher`

### T08: vault/mod.rs — VaultState + commands

**What:** Wire `VaultState` (current path, watcher handle, fingerprint cache, persisted via `tauri-plugin-store`). Register Tauri commands: `vault_open`, `vault_current`, `vault_list`, `notes_read`, `notes_save`, `notes_create`, `notes_rename`, `notes_trash`.
**Where:** `src-tauri/src/vault/mod.rs`, `src-tauri/src/lib.rs`
**Depends on:** T06, T07
**Requirement:** VAULT-01, VAULT-02, VAULT-03
**Done when:** `cargo test` and `cargo clippy` clean.
**Commit:** `feat(vault): wire ipc commands and state`

### T09: TS adapter `src/shared/ipc/client.ts` [P]

**What:** Thin wrapper over `@tauri-apps/api/core::invoke` keyed by `IpcContract`. Provides `client.vault.list()` etc. and `client.events.on('vault.fileChanged', cb)`. Camel-cases payload keys.
**Where:** `src/shared/ipc/client.ts`, tests with mocked `invoke`
**Depends on:** T01
**Requirement:** VAULT-09, VAULT-10
**Done when:** All commands typed; vitest covers happy + error path.
**Commit:** `feat(ipc): typed client adapter`

### T10: Zustand `vaultStore` [P]

**What:** `src/features/vault/state/vaultStore.ts` exposes `path`, `notes`, `loadNotes()`, `openVault()`, plus subscribes to `vault.fileChanged` to mutate the local cache.
**Where:** `src/features/vault/state/vaultStore.ts`
**Depends on:** T09
**Requirement:** VAULT-04, VAULT-09
**Done when:** Component test: external event from mock IPC updates store.
**Commit:** `feat(vault): zustand store with watcher integration`

### T11: Replace mock data in features with real store [P]

**What:** Swap imports in `src/features/{home,drawers,note-view}/...` from `_mock/mockData` to `vaultStore`. Where data is missing (tags, backlinks), keep mock placeholders (handled in F03/F09).
**Where:** mentioned features
**Depends on:** T10
**Requirement:** VAULT-04
**Done when:** App boots, opens a real vault, lists real files; no broken imports.
**Commit:** `refactor(features): consume vault store instead of mock data`

### T12: E2E spec `tests/e2e/vault/open-and-list.spec.ts`

**What:** Build a fixture vault under `tests/fixtures/vaults/sample/`. Playwright spec: launch app, click Open, point at fixture, assert all sample files appear in Recents within 2 s.
**Where:** `tests/e2e/vault/open-and-list.spec.ts`, `tests/fixtures/vaults/sample/`
**Depends on:** T11
**Requirement:** VAULT-01, VAULT-04, VAULT-05
**Done when:** `pnpm test:e2e -- tests/e2e/vault/` green locally.
**Commit:** `test(vault): e2e open and list flow`

### T13: Update STATE.md + ROADMAP.md

**What:** Mark F02 milestones complete in `.specs/project/ROADMAP.md`. Append L-NNN lessons learned.
**Where:** `.specs/project/{ROADMAP,STATE}.md`
**Depends on:** T12
**Done when:** Diffs reflect F02 done.
**Commit:** `docs(state): close out F02 vault fs`

## Granularity check

All tasks ≤ 1 file or ≤ 1 cohesive concept. T08 touches 2 files (mod + lib) but they are coupled.
