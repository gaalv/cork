# State

**Last Updated:** 2026-05-06T19:05-03:00
**Current Work:** F10 vault management, F11 attachments config, and F12 topbar rename complete; next planned work is F13/F14

---

## Recent Decisions (Last 60 days)

### AD-001: Layout C locked (2026-05-06)

**Decision:** Layout C — Minimal + Command — is the locked UI direction for v1. Layouts A and B are archived in `/prototype` for reference.
**Reason:** User chose C after iterating on note discoverability (Home dashboard + rail drawers + command palette). Closest to Tolaria's keyboard-first ethos and keeps the editor focused.
**Trade-off:** Less immediate familiarity than Inkdrop/Obsidian for casual users; bets on power-user UX.
**Impact:** All M2+ features assume Layout C structure (rail + topbar + drawers + home + note-view).

### AD-002: Stack aligned with Tolaria (2026-05-06)

**Decision:** Tauri 2 + React 19 + Vite 7 + TypeScript 5.9 + Tailwind v4 + Phosphor + CodeMirror 6 + SQLite (Rust-side via `rusqlite`).
**Reason:** Mirrors a working production app for a similar use case; reduces unknowns. Tauri keeps bundles small. Tailwind v4 has the new `@theme` model that fits design-token-driven theming.
**Trade-off:** Locked into Tauri ecosystem (vs. Electron); depends on WebKit2GTK on Linux.
**Impact:** All features written for Tauri IPC + React. No SSR, no Node runtime in production.

### AD-003: pnpm via corepack (2026-05-06)

**Decision:** Package manager is **pnpm** (enabled via `corepack`).
**Reason:** User preference; matches Tolaria; faster installs and stricter dep resolution than npm.
**Trade-off:** Requires Node 20+ with corepack; CI must enable corepack.
**Impact:** All commands and CI workflows use `pnpm` (no `package-lock.json`).

### AD-004: SQLite index lives in app data dir, vault stays pure `.md` (2026-05-06)

**Decision:** The index database file lives in the OS app data directory (`~/Library/Application Support/Noxe/` on macOS, `%APPDATA%/Noxe/` on Windows, `~/.local/share/Noxe/` on Linux). The vault folder contains ONLY `.md` files (and whatever the user already has — assets are passthrough).
**Reason:** Vault must stay portable; opening a Noxe vault in Obsidian must "just work".
**Trade-off:** Index can desync if vault is moved without app running; mitigated by re-index-on-open.
**Impact:** F02, F03 assume this split. No sidecar files in the vault for core features.

### AD-005: Markdown parsing — Rust for indexing, JS for rendering (2026-05-06)

**Decision:** Indexing pipeline (extract title, tags, wikilinks, headings) uses Rust `pulldown-cmark` invoked from `src-tauri`. Rendering for preview uses `react-markdown` + `remark-gfm` + `rehype-highlight` (Shiki theme).
**Reason:** Indexing must be fast on large vaults (Rust wins). Rendering needs JS-side React extensibility for KaTeX/Mermaid/wikilink components.
**Trade-off:** Two parsers — must keep their AST notions in sync for things like wikilink shape.
**Impact:** F03, F05, F09 are coupled. A small contract test in F03 verifies parser parity for wikilink and tag extraction.

### AD-006: Editor is CodeMirror 6, not BlockNote (2026-05-06)

**Decision:** CodeMirror 6 with markdown mode is the editor. No BlockNote, no Slate, no rich-text abstraction.
**Reason:** Vault is pure `.md`; a block editor adds an abstraction layer that risks lossy round-trips. CM6 has first-class markdown extensions and integrates with Shiki for code blocks.
**Trade-off:** No drag-to-reorder blocks UX out of the box; can be added in v2 if needed.
**Impact:** F05 builds directly on CM6 plugins (`@codemirror/lang-markdown`, custom wikilink plugin).

### AD-007: File watcher in Rust via `notify` (2026-05-06)

**Decision:** Vault file watching is implemented in `src-tauri` using the `notify` crate, surfaced to the frontend as Tauri events (`vault://changed`).
**Reason:** Native, debounced, cross-platform. Doing it in JS (chokidar) would mean shipping Node, which Tauri doesn't.
**Impact:** F02 owns the watcher. F03 subscribes to `vault://changed` events to reindex incrementally.

### AD-008: Frontend state management = React state + Zustand (2026-05-06)

**Decision:** Local UI state stays in React. Cross-cutting state (active vault, recents list, drawer open/closed, palette open/closed) lives in Zustand stores in `src/shared/stores/`.
**Reason:** Lighter than Redux; works well with React 19's concurrent features; matches Tolaria's pragmatic choice.
**Trade-off:** No time-travel devtools out of the box (Zustand has a redux devtools middleware available).
**Impact:** F04 introduces the store pattern; all later features follow.

### AD-009: Test stack — Vitest + RTL + Playwright (2026-05-06)

**Decision:** Unit + component tests via Vitest + React Testing Library. E2E + smoke via Playwright (against Tauri dev or Vite preview).
**Reason:** Mirrors Tolaria; fast, well-supported, plays nicely with Vite.
**Impact:** F01 wires all three. Each later feature includes at least 1 unit + 1 component test.

### AD-010: Source structure — feature folders + shared core (2026-05-06)

**Decision:**
```
src/
  app/                   # App shell, routing, providers
  features/              # Feature folders (one per Fxx)
    home/                # F06
    shell/               # F04
    editor/              # F05
    note-view/           # F08
    drawers/             # F07
    wikilinks/           # F09
    daily-notes/         # F10
  shared/
    ui/                  # Reusable primitives (Button, Card, Drawer, ...)
    stores/              # Zustand stores
    ipc/                 # Tauri IPC client wrappers
    md/                  # Shared markdown helpers
    types/               # Shared TS types
    utils/
src-tauri/
  src/
    ipc/                 # Tauri command handlers
    vault/               # Filesystem ops
    index/               # SQLite + indexer
    watcher/             # `notify` integration
    main.rs
```
**Reason:** Co-locate UI + hooks + services per feature; shared primitives factored separately. Mirrors how multiple agents can own one feature folder each.
**Impact:** All Fxx tasks reference paths under this structure.

### AD-011: IPC contract — typed via shared TS types (2026-05-06)

**Decision:** Tauri commands declared in `src-tauri/src/ipc/`. Frontend wrappers in `src/shared/ipc/` import a single `IpcContract.ts` listing every command's input/output. Rust side uses `serde` types matching the contract.
**Reason:** Multi-agent safety — if a Rust agent adds a command, the TS agent reads the contract file, not source-spelunks.
**Impact:** F02 introduces `IpcContract.ts`; every later IPC change updates it in the same commit as the Rust handler.


### AD-012: Real AI deferred — only UI stub on note-view (2026-05-06)

**Decision:** The "Sugestão de link" card from the mock is a static UI stub in v1. No LLM call, no embeddings.
**Reason:** Out of v1 scope; protect bundle size and complexity; design surface stays for future.
**Impact:** F08 includes the card as a fixed-content component; no `ai/` feature folder in v1.

### AD-022: Vault path persistence uses app-data JSON for F02 (2026-05-06)

**Decision:** F02 persists the active vault in `vault.json` under Tauri `app_data_dir()` instead of integrating `tauri-plugin-store`.
**Reason:** The JSON file satisfies AD-004 (vault stays pure `.md`) and keeps F02 small while preserving the same app-data location semantics.
**Trade-off:** No plugin-managed migrations yet; F13 settings can migrate this into the settings bridge if needed.
**Impact:** `VaultState` owns config read/write and clears the file when the persisted vault is missing.

### AD-023: Browser E2E uses a localhost-only vault injection hook (2026-05-06)

**Decision:** Playwright web E2E sets fixture vault entries through `window.__noxe_test_setVault(path, notes)`, enabled only for non-production mode or localhost preview.
**Reason:** Playwright runs against Vite preview in a browser, not the Tauri app, so it cannot drive the native folder picker or Rust IPC.
**Trade-off:** The E2E validates UI wiring/listing with a fixture-shaped payload; Rust IPC/file walking remain covered by cargo tests.
**Impact:** Production desktop builds do not expose the hook unless served on localhost for tests.


### AD-024: Index bench split between Rust correctness and CI summary (2026-05-06)

**Decision:** F03 keeps the authoritative SQLite/indexer performance checks in Rust worker tests, while `scripts/bench-index.mjs` provides a deterministic non-blocking CI summary without launching the desktop IPC runtime.
**Reason:** The GitHub Actions browser/Node environment cannot reliably drive Tauri desktop IPC headlessly, but the Rust tests exercise the real parser, WAL database, FTS tables, and incremental worker path.
**Trade-off:** The CI summary numbers are synthetic JS-side timings; use Rust test timings for release gating.
**Impact:** Future desktop IPC benchmarks can replace the JS harness when Tauri E2E automation is available.


### AD-025: F04 shell persists UI route/drawer state in web-safe localStorage (2026-05-06)

**Decision:** F04 persists the shell view and active drawer through a small localStorage adapter instead of adding a Tauri store bridge. Native window geometry uses `tauri-plugin-window-state`.
**Reason:** The shell must also run in Vite preview/Playwright where Tauri plugin APIs are unavailable; F13 will own the durable settings/store bridge.
**Trade-off:** View persistence is browser/WebView-local until F13 settings migration.
**Impact:** `shellStore` can be migrated behind the same API when the settings bridge lands.

### AD-026: Shell host includes temporary F12 folder/bulk compatibility seams (2026-05-06)

**Decision:** F04 Shell exposes minimal folder drawer rows and bulk-selection hooks so the parallel F12 folder/bulk UX can coexist while F07 drawers are still pending.
**Reason:** Multi-agent changes touched shell chrome and drawer surfaces at the same time; preserving both E2E suites avoids regressing either feature.
**Trade-off:** Some folder-specific UI lives in shell temporarily and should move to F07/F12-owned drawer components later.
**Impact:** F07 should replace `DrawerHost` placeholders with dedicated drawer bodies without changing the shell contract.

### AD-027: F07 drawer state uses web-safe localStorage and indexed frontmatter (2026-05-06)

**Decision:** Search history is persisted via the drawer Zustand store to `localStorage` (`noxe.searchHistory`) and starred notes are queried from the F03 `frontmatter` index (`starred: true`) rather than a second `starred.json` source.
**Reason:** Drawers must run in Vite preview/Playwright without Tauri store APIs, and frontmatter keeps starred state portable in the pure Markdown vault.
**Trade-off:** Search history is WebView-local until F13 settings/store migration; starred toggles require the note to be reindexed after save.
**Impact:** F07 `notes.starred` reads the SQLite `frontmatter` table and `starService` writes `frontmatter.starred`.


### AD-028: F05 preview uses split-pane rendering with heavy renderers lazy-loaded (2026-05-06)

**Decision:** Markdown preview ships as a toggleable split pane backed by `react-markdown`; Shiki and Mermaid are loaded lazily, and >1 MB buffers enter degraded mode that disables heavy Mermaid/KaTeX rendering.
**Reason:** Preserves CodeMirror typing responsiveness while meeting MVP preview requirements.
**Trade-off:** This is not hybrid live-preview editing; cursor-adjacent rendered Markdown remains deferred.
**Impact:** F05 owns `EditorPreviewSplit`, the unified preview plugin chain, and CM6 remains the single editing surface.

### AD-029: F05 browser E2E uses fixture-backed editor loading when Tauri IPC is unavailable (2026-05-06)

**Decision:** The shell note route falls back to fixture-shaped note content in localhost/preview runs when `notes.read` is unavailable.
**Reason:** Playwright targets Vite preview, not a desktop Tauri runtime; this keeps editor routing and chaos-save coverage deterministic in CI.
**Trade-off:** Browser E2E validates UI/data-loss behavior, while Rust IPC correctness remains covered by unit/cargo tests.
**Impact:** `ViewRouter` mounts the real editor for note routes without requiring native IPC during web tests.

### AD-030: F11 browser E2E writes attachments through a localhost-only test bridge (2026-05-06)

**Decision:** Asset drop E2E uses `window.__noxe_test_writeAttachment` to route browser-file bytes to a Playwright-exposed Node writer under `test-results/`.
**Reason:** Playwright runs Vite preview without Tauri IPC, but F11 needs to verify the real CM6 drop path, attachment-link insertion, preview image rendering, and on-disk attachment output together.
**Trade-off:** Browser E2E validates frontend integration with a fixture writer; Rust `assets.write_attachment` remains covered by cargo tests.
**Impact:** Production builds do not expose the bridge outside non-production/localhost test runs.

### AD-031: Multi-vault recents and switch tests use web-safe bridges (2026-05-06)

**Decision:** F10 persists recent vaults in the existing app-data `vault.json` and exposes a localhost-only `window.__noxe_test_setRecentVaults` bridge for browser E2E.
**Reason:** Playwright cannot drive native folder pickers or Tauri IPC in Vite preview, but switcher UX still needs deterministic no-data-loss coverage.
**Trade-off:** Browser E2E validates UI/store behavior and failed IPC resilience; Rust tests cover persistence and native settings loading.
**Impact:** Production builds do not expose the recent-vault test bridge outside non-production/localhost runs.

### AD-032: Per-vault attachments default aligns with Rust writer (2026-05-06)

**Decision:** Asset ingest now defaults to `_attachments` and treats an empty `attachmentsFolder` per-vault setting as same-folder mode.
**Reason:** Rust `assets.write_attachment` already used `_attachments`; aligning TS and Rust avoids divergent attachment destinations when config is absent.
**Trade-off:** Existing browser E2E expectations moved from `attachments/` to `_attachments/`.
**Impact:** F11/F13 settings should present `_attachments` as the default attachment folder.

---

## Active Blockers

_None._

---

## Lessons Learned

- **L-001:** Vite preview serves the last `dist/`; E2E scripts that target preview should build first so browser tests exercise current source.
- **L-002:** Watcher echo suppression needs canonical paths because macOS temp paths may differ between `/var` and `/private/var`.
- **L-003:** Vitest on Node 24 can report Tinypool worker termination failures after all tests pass; running Vitest in a single thread keeps the suite deterministic.
- **L-004:** `cmdk` needs `ResizeObserver` and `scrollIntoView` shims in jsdom component tests.
- **L-005:** Browser E2E shortcut assertions are more reliable when shell shortcuts also listen for explicit `metaKey || ctrlKey` fallbacks in addition to `tinykeys` `$mod`.
- **L-006:** Browser drawer E2E needs web-safe fallbacks for native IPC-backed queries; keep the fallback deterministic and fixture-shaped.
- **L-007:** CM6 autocompletion sources must be merged into a single `autocompletion({ override })` extension; stacking multiple override facets causes config merge conflicts.
- **L-008:** Browser editor E2E should use contenteditable `fill()` for deterministic large text insertion; raw keyboard typing can be dropped by CM6 under fast automation.
- **L-009:** CM6 drop tests in jsdom may resolve coordinates to position 0; assert insertion and service calls rather than relying on pixel layout.
- **L-010:** Browser Home E2E needs fixture-backed note reads/frontmatter toggles because Playwright preview cannot call Tauri IPC.
- **L-011:** NoteView must not reload a dirty existing buffer when navigating away and back during a failed vault switch; otherwise fixture/native reads can overwrite unsaved edits.
- **L-012:** Home E2E note locators should target the intended section because Recents, All Notes, and card menus can expose duplicate note-title buttons.

---

## Quick Tasks Completed

| #   | Description                              | Date       | Commit | Status   |
| --- | ---------------------------------------- | ---------- | ------ | -------- |
| 001 | Initialize project (.specs/project)      | 2026-05-06 | —      | ✅ Done  |
| 002 | Build layout playground (3 layouts)      | 2026-05-06 | —      | ✅ Done  |
| 003 | Refine Layout C (drawers + home)         | 2026-05-06 | —      | ✅ Done  |
| 004 | Lock Layout C and write multi-agent plan | 2026-05-06 | —      | ✅ Done  |
| 005 | Author specs/design/tasks for F01–F10    | 2026-05-06 | —      | ✅ Done  |
| 006 | Author AGENTS.md (multi-agent contract)  | 2026-05-06 | —      | ✅ Done  |
| 007 | Reflect 123 atomic tasks into SQL todos with deps | 2026-05-06 | — | ✅ Done |
| 008 | Author F11–F14 (assets, folder ops, settings, markdown ext.) + mini-tasks F05-T18 / F04-T14 | 2026-05-06 | — | ✅ Done |
| 009 | Implement F01 Foundation (Tauri + React + tooling + CI + legacy migration); typecheck/lint/test/build/cargo test/e2e all green | 2026-05-06 | — | ✅ Done |
| 010 | Implement F02 Vault FS (typed IPC, Rust vault IO/list/watch, vault store, legacy UI bridge, E2E fixture flow) | 2026-05-06 | f68ef01 | ✅ Done |
| 011 | Implement F03 Index (SQLite schema/migrations, Rust+TS markdown parser parity, worker, IPC, store/UI integration, crash safety) | 2026-05-06 | de3de18 | ✅ Done |
| 012 | Implement F04 Shell (Zustand shell store, rail/topbar/drawers, cmdk palette, shortcuts/help/toasts, empty state, router, window-state, E2E) | 2026-05-06 | multiple | ✅ Done |
| 013 | Partially land F12 Folder Ops & Bulk Operations (folder/bulk IPC, legacy folder UI, drag/drop, bulk selection, auto-close, E2E); T10 deferred pending F09-T03 | 2026-05-06 | multiple | ✅ Partial |
| 014 | Partially implement F11 Asset Pipeline (asset DB/walker, scoped protocol, attachment IPC, resolver/url/open helpers); T07/T09/T10/T11/T12 deferred to F05/F10 | 2026-05-06 | multiple | ✅ Partial |
| 015 | Implement F07 Drawers (FTS search, folders, recent, starred, tags, a11y, E2E) | 2026-05-06 | multiple | ✅ Done |
| 016 | Implement F05 Editor (CM6, autosave/conflicts, Markdown preview, Shiki/KaTeX/Mermaid, completions, split view, search, chaos E2E) | 2026-05-06 | multiple | ✅ Done |
| 017 | Implement F06 Home Dashboard (query-backed hero, pinned/recents/tags/all notes, pin flow E2E) | 2026-05-06 | multiple | ✅ Done |
| 018 | Implement F08 Note View + Meta Panel (store, outline/backlinks/hooks, responsive meta panel, NoteView composition) | 2026-05-06 | multiple | ✅ Done |
| 017 | Complete F11 remaining asset pipeline tasks (preview image rendering, CM6 image drop/paste, drop-render E2E); T11 deferred pending F10-T11 | 2026-05-06 | multiple | ✅ Partial |
| 019 | Complete F10 vault management (close/recent, switcher, per-vault config, switch chaos E2E) plus unblock F11 attachments config and F12 topbar rename | 2026-05-06 | multiple | ✅ Done |

---

## Deferred Ideas

- [ ] Hybrid editor mode (live-preview within CM6) — deferred after F05 split-pane decision
- [ ] Drag-to-reorder blocks UX — would require BlockNote; defer to v2
- [ ] Real AI link suggestions backed by local embeddings — captured under "Future Considerations"
- [ ] Graph view — captured under "Future Considerations"

---

## Todos

- [x] Decide on the Markdown render preview strategy: split pane selected for F05; hybrid deferred
- [x] Decide on the wikilink resolution algorithm details — documented in F09 design
- [x] Choose CI provider — GitHub Actions, locked in F01

## Architectural Decisions (added in this checkpoint)

- **AD-013**: Author full multi-agent spec set (`spec.md`+`design.md`+`tasks.md`) for F01–F10 plus root `AGENTS.md`. All 123 atomic tasks reflected in the session SQL `todos` table with dependencies for parallel agent execution. Task IDs follow `Fxx-Tyy`. Each task spec includes Done-when, Verify, Commit, and Reuses.
- **AD-014**: Two-parser parity (Rust `pulldown-cmark` for index, JS `unified/remark` for preview) is enforced by a CI gate (`tests/parity/`) — see F03-T06. Risk R-001 owned by F03.
- **AD-015**: Editor performance budget — typing latency p95 < 16 ms, preview update p95 < 80 ms, cold start < 1.5 s, 1k-vault index build < 3 s. Enforced by F03-T12 bench harness and F05-T17 chaos test.
- **AD-016**: External-change reconciliation handled in editor via `useExternalReconciler` (F05-T06) reading `vault.fileChanged` events and either reloading silently (clean buffer) or showing the conflict banner (dirty buffer with optimistic mtime mismatch).
- **AD-017**: Wikilink rename propagation defaults ON; toggle via `appSettingsStore.autoRewriteLinksOnRename`. Resolver pass always updates `target_id` in the index regardless. (F09-T08)
- **AD-018**: Asset access in preview uses Tauri 2 `asset://localhost/<abs>` protocol with a runtime-updated scope (`assets.set_scope` IPC) constrained to the active vault. Static `tauri.conf.json` scope is empty; Rust expands per vault. New `assets` SQLite table (migration 003) is populated by extending the F02 walker to known media extensions. (F11)
- **AD-019**: Folder operations live in a dedicated `folders.*` IPC namespace (`create/rename/move/trash`); deletes go to OS trash via the same path as `notes.trash`. Bulk note operations (`notes.bulkMove/bulkTrash/bulkSetFrontmatter`) report `{ ok[], failed[] }` so partial failures don't abort the batch. Drag-and-drop powered by `@dnd-kit/core` with keyboard-accessible "Move to…" fallback. (F12)
- **AD-020**: Settings is implemented as a modal panel (not a separate route) with sections General/Editor/Files & Vaults/Markdown/Daily Notes/Advanced. Per-vault overrides written to `<vault>/.noxe/config.json`; global settings via `tauri-plugin-store`. `settingsBridge` resolves per-vault → global → default. In-note find/replace via `@codemirror/search`. Native menus via Tauri 2 menu API; `tauri-plugin-window-state` for window persistence. (F13)
- **AD-021**: Markdown extensions (callouts, footnotes, highlight) shipped as opt-in flags consumed by both the unified pipeline (custom remark plugins) and pulldown-cmark (event-stream adapters). Parity gate (F08) extended with new fixtures; both pipelines must produce byte-identical (after whitespace normalization) HTML. Definition lists, math, mermaid deferred to v2. (F14)

---

## Preferences

**Model Guidance Shown:** never
