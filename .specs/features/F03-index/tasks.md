# F03 — Index Tasks

```
T01 → T02 → T03 → { T04[P], T05[P] } → T06 → T07 → T08 → { T09[P], T10[P] } → T11 → T12 → T13 → T14
```

### T01: IPC contract additions
**What:** Extend `IpcContract.ts` with `notes.recent/byTag/byFolder/byId`, `tags.list`, `links.outgoing/incoming`, `index.rebuild`, plus events.
**Where:** `src/shared/ipc/IpcContract.ts`
**Depends on:** F02
**Requirement:** INDEX-12..16, 20
**Done when:** Types compile.
**Commit:** `feat(ipc): index contract`

### T02: Rust deps + schema.sql
**What:** Add `rusqlite = { version = "0.31", features = ["bundled"] }`, `pulldown-cmark`, `regex`, `sha1` to Cargo.toml. Author `src-tauri/src/index/schema.sql` per design.
**Where:** `Cargo.toml`, `src-tauri/src/index/schema.sql`, `src-tauri/src/index/{mod,migrate,parser,worker,query,paths}.rs` (empty stubs)
**Depends on:** T01
**Requirement:** INDEX-03
**Done when:** `cargo build` clean.
**Commit:** `chore(index): add deps and schema`

### T03: migrate.rs
**What:** Open/create DB at `<app_data>/vaults/<vault_hash>/index.sqlite`. Run schema.sql if `schema_version` missing. On corrupt DB → delete file and retry once.
**Where:** `src-tauri/src/index/migrate.rs`, `src-tauri/src/index/paths.rs`
**Depends on:** T02
**Requirement:** INDEX-03, INDEX-17, INDEX-18
**Done when:** Tests: fresh dir → schema present; corrupt file → recreated.
**Commit:** `feat(index): migration runner`

### T04: parser.rs (Rust) [P]
**What:** Implement `parse(body) -> ParsedNote` using pulldown-cmark. Extract title (first H1 or fallback to filename param), tags, wikilinks (with alias), heading list. Code blocks excluded. Body hash (sha1) computed on raw body.
**Where:** `src-tauri/src/index/parser.rs`
**Depends on:** T02
**Requirement:** INDEX-05, INDEX-06
**Done when:** ≥ 10 unit tests covering edge cases listed in spec edge cases.
**Commit:** `feat(index): rust markdown parser`

### T05: parser.ts (JS, parity twin) [P]
**What:** `src/shared/parsers/markdown.ts` exposes `parse(body, filename)` returning the same shape. Uses `unified`, `remark-parse`, `remark-gfm`, `remark-wikilink` (or local plugin if needed). Code excluded same way.
**Where:** `src/shared/parsers/markdown.ts`
**Depends on:** T01
**Requirement:** INDEX-19
**Done when:** Vitest covers same edge cases.
**Commit:** `feat(parsers): js markdown twin`

### T06: parity test (CI gate)
**What:** Test runner `tests/parity/parser-parity.spec.ts` and `src-tauri/tests/parity.rs` both load `tests/fixtures/parity/*.md` and emit JSON. A pnpm script `pnpm test:parity` calls both, normalizes (sort arrays), and `diff`s.
**Where:** `tests/parity/`, `tests/fixtures/parity/`, `package.json`
**Depends on:** T04, T05
**Requirement:** INDEX-19
**Done when:** Diff is empty across 8+ fixtures (basic, frontmatter, tags-in-code, wikilink-with-alias, headings, etc.).
**Commit:** `test(parity): rust↔js parser parity gate`

### T07: query.rs
**What:** Implement read functions: `recent`, `by_tag` (recursive via prefix `tag` + `tag/%`), `by_folder` (prefix), `by_id`, `tags_list`, `links_outgoing`, `links_incoming`.
**Where:** `src-tauri/src/index/query.rs`
**Depends on:** T03
**Requirement:** INDEX-12..16
**Done when:** Integration tests against a seeded DB.
**Commit:** `feat(index): query functions`

### T08: worker.rs (build + incremental)
**What:** Worker thread loop. Jobs: `BuildAll` (walks via F02 list, parses each file, batches inserts in 100-row chunks, emits progress every 100 ms or 50 files). `Upsert` reparses if body_hash changed. `Remove` cascades. `Rename` updates row only.
**Where:** `src-tauri/src/index/worker.rs`
**Depends on:** T03, T04, T07
**Requirement:** INDEX-01, INDEX-02, INDEX-08, INDEX-09, INDEX-10, INDEX-11, INDEX-20
**Done when:** Bench: 1k synthetic notes built in < 3 s on dev machine. Single update < 200 ms.
**Commit:** `feat(index): build + incremental worker`

### T09: mod.rs + Tauri commands [P]
**What:** Wire `IndexState` (Mutex<Connection>, worker Sender). Register commands matching IpcContract. Subscribe to `vault.fileChanged` events from F02 and forward to worker.
**Where:** `src-tauri/src/index/mod.rs`, `src-tauri/src/lib.rs`
**Depends on:** T07, T08
**Requirement:** INDEX-08..16
**Done when:** End-to-end: open vault → DB built → modify file → row updated.
**Commit:** `feat(index): wire ipc + watcher subscription`

### T10: TS adapter additions [P]
**What:** Extend `client.ts` with the new namespaces. Add Zustand `indexStore` exposing `progress`, `ready`, plus query helpers.
**Where:** `src/shared/ipc/client.ts`, `src/features/index/state/indexStore.ts`
**Depends on:** T01, T09
**Requirement:** INDEX-12..16, 20
**Done when:** Tests with mocked IPC.
**Commit:** `feat(index): client adapter + zustand store`

### T11: Replace mock recents/tags in UI
**What:** Home's RecentsList, TagPills, By Tag section, drawers' Recent/Tags now hit `indexStore`. Loading skeletons shown while `index.ready` is false.
**Where:** features touching those views
**Depends on:** T10
**Requirement:** INDEX-12, INDEX-15
**Done when:** App shows real recents/tags from a real vault.
**Commit:** `refactor(home|drawers): use real index data`

### T12: Bench harness
**What:** Script `scripts/bench-index.mjs` generates an N-note synthetic vault and times build/update via the IPC path. Used in CI as a non-blocking job that records numbers in a job summary.
**Where:** `scripts/bench-index.mjs`, `.github/workflows/quality.yml`
**Depends on:** T09
**Requirement:** INDEX-02
**Done when:** Output prints `build_ms`, `incremental_ms_p50`, `incremental_ms_p95`.
**Commit:** `test(bench): index performance harness`

### T13: Crash-safety integration test
**What:** Test that opens DB, writes during a transaction, hard-aborts process (subprocess pattern), reopens — DB must still be valid.
**Where:** `src-tauri/tests/index_crash.rs`
**Depends on:** T03
**Requirement:** INDEX-17
**Done when:** Test passes locally on macOS + Linux.
**Commit:** `test(index): WAL crash safety`

### T14: Update STATE/ROADMAP
**Where:** `.specs/project/{ROADMAP,STATE}.md`
**Done when:** F03 marked done; lessons captured.
**Commit:** `docs(state): close out F03 index`
