# F48 — Cork CLI Tasks

**Design:** `.specs/features/F48-cli/design.md`
**Status:** Draft

No automated tests (project decision). Verify = `cargo check` (+ `pnpm typecheck && pnpm lint` when IPC types are touched) + manual UAT per task, run with the app **both open and closed**.

## Execution Plan

### Phase 1 — Foundation (Sequential — everything depends on this)

```
T01 → T02 → T03 → T04 → T05
```

### Phase 2 — Command families (Parallel after T05)

```
T05 ──┬→ T06 note   [P]
      ├→ T07 folder [P]
      ├→ T08 tag    [P]
      └→ T09 query  [P]
```

### Phase 3 — Ergonomics & ship (Sequential)

```
T09 → T10 json → T11 windows → T12 install → T13 docs
```

---

## Phase 1 — Foundation

### T01 — `Emitter` trait + `VaultCtx` struct (CLI-02)

- **What:** New `core/` module: `Emitter` trait with `TauriEmitter(AppHandle)` and `NoopEmitter`; `VaultCtx { vault_root, app_data_dir, fingerprint_cache, emitter }` with `with_conn`, `emit`, and a stub `reindex_paths`. No behavior moved yet — just the types compiling.
- **Where:** `src-tauri/src/core/mod.rs`, `src-tauri/src/core/ctx.rs`, `src-tauri/src/core/emit.rs`, register `mod core` in `lib.rs`
- **Reuses:** `FingerprintCache` (`vault/fingerprint.rs`), `index::paths`
- **Done when:** `cargo check` passes; `VaultCtx` constructible in a throwaway unit path; nothing else changed.
- **Commit:** `feat(cli): add VaultCtx core context and Emitter abstraction`

### T02 — Shared `app_data_dir` + db-path resolver, verified against Tauri (CLI-03)

- **What:** One helper resolving `app_data_dir` for identifier `com.cork.app` per-OS (XDG-aware on Linux), used by BOTH the GUI state layer and the CLI. Wire the GUI's existing `IndexState.app_data_dir` to go through it so they can't diverge. **Verify** the exact dir Tauri 2 emits for this identifier before locking values (Knowledge Verification Chain).
- **Where:** `src-tauri/src/core/paths.rs` (or extend `index/paths.rs`), call sites in `index/mod.rs`
- **Reuses:** `index::paths::index_db_path`, `vault_hash`
- **Done when:** GUI still opens the same db it does today (unchanged behavior); the helper returns that identical path when called standalone.
- **Commit:** `feat(cli): shared app-data-dir resolver for GUI+CLI index parity`

### T03 — Route `vault/` + `index/` ops through `VaultCtx` (CLI-02)

- **What:** Refactor the free-function layer so note/folder/tag/query/reindex ops take `&VaultCtx` instead of `AppHandle`/`tauri::State`; replace inline `app.emit(...)` with `ctx.emit(VaultEvent::…)`. Each `#[tauri::command]` becomes a thin shell that builds a `VaultCtx` (TauriEmitter) from `State`/`AppHandle` and delegates. **GUI behavior must stay byte-identical — all current events still fire.**
- **Where:** `src-tauri/src/vault/mod.rs`, `bulk.rs`, `folders.rs`, `archive.rs`, `replace.rs`; `src-tauri/src/index/mod.rs`, `query.rs`
- **Depends on:** T01, T02
- **Reuses:** existing free fns (`io::`, `rename_propagation::`, `folders::`, `query::`)
- **Done when:** GUI runs unchanged (open vault, create/rename/tag/move/search all still emit + update live); `cargo check` clean. Manual UAT in the app confirms no regression.
- **Commit:** `refactor(vault,index): route ops through VaultCtx, decouple emit`

### T04 — Implement `VaultCtx::reindex_paths` one-shot indexer (CLI-09)

- **What:** Synchronous upsert of given `.md` paths into the shared SQLite (open WAL + `busy_timeout`), reusing the worker's parse/upsert routines without the background channel. Build the db if absent.
- **Where:** `src-tauri/src/core/ctx.rs`, reusing `src-tauri/src/index/worker.rs` upsert internals (extract a callable fn if currently private to the worker loop)
- **Depends on:** T01, T02
- **Reuses:** `index::worker` parse/upsert, `index::parser`
- **Done when:** Calling `reindex_paths` on a modified note updates the row; concurrent GUI access doesn't deadlock (WAL + timeout).
- **Commit:** `feat(cli): synchronous one-shot reindex on VaultCtx`

### T05 — `cli` module: dual-mode entry, `clap` skeleton, vault resolution (CLI-01, CLI-04)

- **What:** Add `clap`; `cli::is_cli_invocation` + `cli::dispatch`; branch in `cork_lib::run` (subcommand → `process::exit(dispatch())`, else GUI unchanged). `--vault`/cwd-walk/recent resolution (confirm the vault marker `vault.open` uses). `--version` prints app version. Wire `--help`. Commands are stubs returning "not implemented" for now.
- **Where:** `src-tauri/src/cli/mod.rs`, `cli/resolve.rs`, modify `src-tauri/src/lib.rs`; add `clap` to `Cargo.toml`
- **Depends on:** T01–T04
- **Reuses:** `vault_recent` for fallback; `VaultCtx` construction
- **Done when:** `cork --version` prints the app version; bare launch still opens the GUI; `cork note ls` resolves a vault (or errors with the `--vault` hint) and hits a stub.
- **Commit:** `feat(cli): dual-mode entry, clap skeleton, vault resolution`

---

## Phase 2 — Command families

### T06 [P] — `cork note` commands (CLI-05)

- **What:** `new` (→ `notes.create` logic, `--folder`/`--tag`), `retitle` (→ `notes.rename` + `rename_propagation`), `mv` (→ `notes.move`), `rm` (→ `notes.trash`), `ls` (→ index list with `--folder/--tag/--status`), `show` (→ `notes.read`, `--frontmatter`). Each calls the core op via `VaultCtx` then `reindex_paths`. `<path|id>` resolution + ambiguity error.
- **Where:** `src-tauri/src/cli/commands/note.rs`
- **Depends on:** T05
- **Done when:** `cork note new "Foo" --tag bar` creates the file; `cork note retitle Foo "Baz"` renames AND rewrites `[[Foo]]`→`[[Baz]]` in linking notes; app (if open) reflects it.
- **Commit:** `feat(cli): note commands (new/retitle/mv/rm/ls/show)`

### T07 [P] — `cork folder` commands (CLI-06)

- **What:** `new`/`rename`/`mv`/`rm`/`ls` mapping to `folders.create/rename/move/trash/list`. Collision → same error as GUI (no silent overwrite).
- **Where:** `src-tauri/src/cli/commands/folder.rs`
- **Depends on:** T05
- **Done when:** `cork folder new Projects/Alpha` then `cork folder ls` shows it; rename/move/rm behave like the GUI.
- **Commit:** `feat(cli): folder commands`

### T08 [P] — `cork tag` commands (CLI-07)

- **What:** `add`/`rm` on a note via frontmatter `tags:` (idempotent add; remove key when empty) + `reindex_paths`; `rename`/`rm-all` across the vault reusing `query::tags_rename`/`tags_delete` + `*_in_frontmatter`; `ls [<note>]` with counts. Normalize tag strings the same way the indexer does.
- **Where:** `src-tauri/src/cli/commands/tag.rs`
- **Depends on:** T05
- **Reuses:** `vault/frontmatter.rs` (`rename_tag_in_frontmatter`, `remove_tag_from_frontmatter`), `index/query.rs` tag fns
- **Done when:** `cork tag add Foo urgent` writes `tags: [urgent]`; `cork tag rename urgent p1` rewrites it in every note; `cork tag ls` shows counts.
- **Commit:** `feat(cli): tag commands (add/rm/rename/rm-all/ls)`

### T09 [P] — `cork search` / `links` / `reindex` (CLI-08)

- **What:** `search "<q>"` (→ `index.search`/FTS), `links <note> [--incoming|--outgoing]` (→ `links.incoming/outgoing`, both by default), `reindex` (→ full `index.rebuild` for the vault).
- **Where:** `src-tauri/src/cli/commands/query.rs`
- **Depends on:** T05
- **Reuses:** `index/search.rs`, `index/query.rs`
- **Done when:** `cork search foo` returns ranked hits; `cork links Foo` lists back/outgoing links; `cork reindex` rebuilds.
- **Commit:** `feat(cli): search, links, and reindex commands`

---

## Phase 3 — Ergonomics & ship

### T10 — `--json` output + exit codes across all commands (CLI-10)

- **What:** Global `--json` → single JSON doc on stdout, human text otherwise. Central `output::render(value, json: bool)`. Errors → non-zero exit + message on **stderr** (never on `--json` stdout). Map `IpcError` variants to exit codes.
- **Where:** `src-tauri/src/cli/output.rs`, touches every command module
- **Depends on:** T06, T07, T08, T09
- **Reuses:** `serde` derives already on the DTOs; `serde_json`
- **Done when:** `cork search foo --json | jq` parses; a failing command returns non-zero with clean stderr and empty/absent stdout.
- **Commit:** `feat(cli): json output and honest exit codes`

### T11 — Windows console attach in CLI mode (CLI-11)

- **What:** On Windows, `AttachConsole(ATTACH_PARENT_PROCESS)` (fallback `AllocConsole`) at the top of `cli::dispatch` so stdout/stderr reach the terminal despite `windows_subsystem = "windows"`. No-op elsewhere.
- **Where:** `src-tauri/src/cli/mod.rs` (cfg-gated), possibly `windows-sys` dep
- **Depends on:** T05
- **Done when:** On Windows, `cork --version` prints to the calling terminal; GUI launch shows no stray console.
- **Commit:** `feat(cli): attach parent console on Windows in CLI mode`

### T12 — Install parity: `cork` on PATH (CLI-12)

- **What:** `install.sh` macOS branch symlinks `cork` → `Cork.app/Contents/MacOS/Cork` into `/usr/local/bin` (fallback `$HOME/.local/bin` + PATH note), mirroring the existing `/Applications` fallback pattern. Confirm Linux shim passes argv through to dual-mode. Note Windows PATH/`cork.cmd` as a follow-up if not trivial.
- **Where:** `install.sh`
- **Depends on:** T05 (needs dual-mode working)
- **Done when:** Fresh `curl … | sh` on macOS yields a working `cork --version`; Linux `cork note ls` works; app still launches normally.
- **Commit:** `feat(install): put cork CLI on PATH alongside the app`

### T13 — Docs + close-out (CLI-01..CLI-12)

- **What:** README CLI section (grammar + examples), ROADMAP F48 → COMPLETE, STATE.md decision (AD for dual-mode + VaultCtx) and quick-task/close-out. Optional `cork completions` (P3, CLI-13) if cheap via clap.
- **Where:** `README.md`, `.specs/project/ROADMAP.md`, `.specs/project/STATE.md`
- **Depends on:** T10, T11, T12
- **Done when:** README documents every P1/P2 command; specs reflect COMPLETE.
- **Commit:** `docs(cli): document Cork CLI and close out F48`

---

## Traceability

| Req    | Tasks              |
| ------ | ------------------ |
| CLI-01 | T05                |
| CLI-02 | T01, T03           |
| CLI-03 | T02                |
| CLI-04 | T05                |
| CLI-05 | T06                |
| CLI-06 | T07                |
| CLI-07 | T08                |
| CLI-08 | T09                |
| CLI-09 | T04, T06–T08       |
| CLI-10 | T10                |
| CLI-11 | T11                |
| CLI-12 | T12                |
| CLI-13 | T13 (P3, optional) |

## Granularity check

| Task    | Scope                            | Status                                                                     |
| ------- | -------------------------------- | -------------------------------------------------------------------------- |
| T01     | 1 module (types only)            | ✅                                                                         |
| T02     | 1 helper + call-site rewire      | ✅                                                                         |
| T03     | Wide refactor across vault+index | ⚠️ Large but cohesive — one mechanical pass; split per-file if it balloons |
| T04     | 1 method                         | ✅                                                                         |
| T05     | entry + skeleton + resolve       | ⚠️ cohesive foundation; keep stubs to stay bounded                         |
| T06–T09 | 1 command family each            | ✅                                                                         |
| T10–T13 | 1 concern each                   | ✅                                                                         |

**Watch T03**: if the delegation refactor exceeds a clean single pass, split into `T03a vault/`, `T03b index/`.
