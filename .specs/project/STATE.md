# State

**Last Updated:** 2026-05-15T17:55-03:00
**Current Work:** F31 closed and M9 marked COMPLETE. Next milestone is M10 (Release prep) — specs not yet written.

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

### AD-033: Markdown extension parity tracks semantic extension tokens (2026-05-06)

**Decision:** F14 extends the F03 parser parity contract with `markdownExtensions` semantic tokens instead of byte-identical HTML snapshots for the Rust indexer.
**Reason:** The Rust path indexes Markdown semantics and does not render preview HTML; token parity validates callout, footnote, and highlight recognition without coupling the index to React preview markup.
**Trade-off:** HTML shape remains covered by TS preview component tests and markdown/html fixtures, while Rust validates indexing semantics.
**Impact:** Future Markdown extensions should add a stable token shape first, then renderer-specific tests.

### AD-034: F13 settings UI uses a dedicated UI store and reuses the settings bridge (2026-05-06)

**Decision:** Settings modal visibility/section state lives in `useSettingsUiStore`, while persisted values continue through the F13 app/vault settings stores and `settingsBridge`.
**Reason:** Keeps shell commands, shortcuts, palette, and native menu actions able to open specific settings sections without coupling to panel internals.
**Trade-off:** The settings panel is not route-addressable yet; deep links can be added later if needed.
**Impact:** Menu, palette, and keyboard shortcuts dispatch to the same UI store.

### AD-035: Native menu forwards stable action IDs to the existing command layer (2026-05-06)

**Decision:** Tauri menu events emit `menu.action` string IDs and TypeScript dispatches those IDs into shell/settings/vault actions.
**Reason:** Keeps Rust menu construction simple and avoids duplicating business logic in native code.
**Trade-off:** Native menu behavior needs manual UAT on macOS/Windows/Linux because browser tests cannot exercise OS menubars.
**Impact:** New menu actions should add a stable ID in `src-tauri/src/menu.rs` and a matching branch in `menuActions.ts`.

### AD-036: AI pivots from generic chat (F20) to contextual skills (F21–F24) (2026-05-07)

**Decision:** Drop the F20 generic chat panel. Replace with three integrated AI features (Insights sidebar, Generate-from-topic, Slash commands) built on a small skills + cache + telemetry infrastructure (F21). No embeddings, no RAG, no HTTP API providers — keep using `claude` / `copilot` CLI subprocesses.
**Reason:** User feedback — generic chat is already free-form-Q&A territory that the user's AI CLIs handle better directly against the `.md` files. Noxe's leverage is contextual integration in the editor and note view. Embeddings/RAG add a heavy dependency (model download, vector DB) for a use case the CLI already covers.
**Trade-off:** "Ask my vault" semantic search isn't built into Noxe — users relying on it must invoke their AI CLI manually against the vault folder. Tag-overlap "Related notes" replaces it inside the app.
**Impact:** F20 marked SUPERSEDED in roadmap; spec stays as historical reference. F21 spec written; F22–F24 to follow. The existing `ai_send_prompt` command is kept as the low-level subprocess primitive that the new `ai_run_skill` runner builds on.

### AD-037: AI generation runs background-first with sonner toasts (2026-05-07)

**Decision:** Long-running AI calls (notably `generate-note` and the slash commands) dispatch through the F21 runner in the background; the UI does not block. Progress / success / error are surfaced via sonner toasts. Per-skill `timeout_secs` in the skill YAML frontmatter overrides the 60s default.
**Reason:** A 60s synchronous freeze made the editor feel broken even though the LLM was healthy. Streaming Claude/Copilot stdout is not available in non-interactive mode, so the cheap, robust win was to detach the call.
**Trade-off:** No live progress bar (only toast). Cancelling an in-flight call is not implemented — the subprocess runs until completion or timeout.
**Impact:** All AI-skill consumers must accept a Promise resolved out-of-band; no synchronous result is exposed in the UI thread. Documented in F23 / F24 specs.

### AD-038: F26 sync uses SSH-only auth (HTTPS+PAT removed) (2026-05-07)

**Decision:** GitHub sync uses SSH exclusively. Per-vault SSH Deploy Key is the recommended setup; the runner auto-falls-back to `ssh.github.com:443` when port 22 is blocked (typical on corporate / coffee-shop networks). HTTPS+PAT and the prior `gh`-CLI auto-create flow are removed from both UI and backend.
**Reason:** macOS Keychain + `gh` credential helpers consistently override per-repo `extraheader` PAT credentials, producing HTTP 403 with the PAT showing as "never used" on GitHub. After multiple iterations the team accepted the system-level constraint and pivoted. Provisional F27 work is captured in `.specs/features/F27-cross-account-sync-pivot/` as "absorbed into F26".
**Trade-off:** First-run setup is heavier — the user must add a Deploy Key to the GitHub repo. User feedback labelled this acceptable ("for devs this is intuitive and secure").
**Impact:** Single sanctioned auth path simplifies the codebase considerably; AD-022 in this file is superseded by this entry.

### AD-039: Sweep-on-sync covers the entire vault (2026-05-07)

**Decision:** Each sync iteration commits **all** changed files inside the vault, not only the actively edited note. Excludes `.git/`, `.noxe/local-history/` and other non-shareable artefacts. Commit message format is Conventional Commits with a file-list trailer:

```
feat(notes): update Welcome.md, Daily/2026-05-07.md (+3 more)

Source: noxe-app
Timestamp: 2026-05-07T12:34:56Z
Files:
  - Welcome.md
  - Daily/2026-05-07.md
  - .noxe/todos.json
```

Scope classification rules: `notes` (only note files), `single` (one file), `mixed` (notes + non-note files), `empty` (sweep with no changes — skipped). Capped at 25 file lines in the trailer.
**Reason:** User reported that the GitHub repo did not reflect what was in the app — todos and `.noxe/*` settings were silently excluded.
**Trade-off:** Slightly larger commits and more frequent activity in the repo timeline.
**Impact:** Commit log is now a usable audit trail. AD-022's reference to "note-only commits" is superseded.

### AD-040: Dual layout modes with viewport guardrail (2026-05-07)

**Decision:** Ship both Focus (current 2-column) and Triage (3-column nav + list + view) layouts as a user-toggleable `layout.mode` setting. Toggle via Settings → Appearance and via `Cmd+Shift+M`. When viewport width < 1100px the renderer silently downgrades Triage to Focus to prevent cramped panels; the setting persists.
**Reason:** User stays attached to the Linear-style 3-column prototype while preferring Focus for actual writing. Forcing one or the other rejected; both are first-class.
**Trade-off:** Two layouts to keep in sync. Mitigated by sharing all body components and routing — only the chrome differs.
**Impact:** New components live under `src/features/shell/ui/triage/*` (NavPane, ListPane, TriageBody) plus `Splitter.tsx`, `state/triageStore.ts`, `hooks/useViewportWidth.ts`. Shortcut conflict avoided: `Cmd+Shift+L` stays bound to `cycleTheme`. No `react-resizable-panels` dependency — custom Splitter (zero deps).

### AD-041: First-run onboarding scaffold (2026-05-07)

**Decision:** New vaults are seeded with a small, opinionated set of files on first open: `Welcome.md`, `Daily/<today>.md`, `Projects/Sample.md`, `Meetings/Sample.md`, `Cheatsheet.md`, plus three starter todos in `.noxe/todos.json`. Idempotency is enforced via `.noxe/scaffold.json` marker; existing files are never overwritten.
**Reason:** Empty vaults make the app feel inert — Linear/Obsidian both seed examples that demonstrate features. User explicitly approved seeding their own vault for the demo.
**Trade-off:** Marker file lives in `.noxe/`, so deleting it triggers re-seed. This is by design — it lets advanced users replay the scaffold.
**Impact:** New Rust module `src-tauri/src/vault/scaffold.rs` with `vault.scaffoldIfNeeded` IPC; called once per vault open after watcher initialisation.

### AD-042: Dark theme un-deferred via runtime CSS variables (2026-05-09)

**Decision:** Ship Light / Dark / System theme switching now (F15) instead of waiting for v2. Theme is applied at module-load via a `<html data-theme>` attribute + CSS-variable token sets in `index.css`; Shiki swaps between `vitesse-light` and `vitesse-dark`.
**Reason:** PROJECT.md "Dark theme — Out of scope for v1" was a planning artefact; the user actually wanted dark from day one and the cost was small once tokens were already variable-based.
**Trade-off:** Adds a tiny runtime to listen for `prefers-color-scheme` changes and reapply tokens; CodeMirror theme had to be reworked to consume the same vars.
**Impact:** PROJECT.md "Dark theme deferred" line is superseded. AppearanceTheme widens from `"light"` to `"light" | "dark" | "system"`. AD-012 stays valid.

### AD-043: Single-pane editor via CM6 decorations (no BlockNote) (2026-05-09)

**Decision:** Bring the Obsidian / Tolaria single-pane "WYSIWYG-feel" editing to Noxe (F16) by adding decoration plugins on top of CodeMirror 6 that conceal markdown markers when the caret leaves the line. The split-pane Preview is kept available for blocks (KaTeX / Mermaid / Shiki) but is no longer the default note view.
**Reason:** Honour AD-006 (CM6, no BlockNote) and AD-028 (split-pane) while addressing the user feedback that 50/50 split wastes horizontal space. Decorations stay lossless because the markdown on disk is untouched.
**Trade-off:** Fenced code blocks, math and Mermaid still render raw inside the editor — only inline markers (headings, emphasis, code, links, wikilinks) get the WYSIWYG treatment.
**Impact:** AD-028 still describes the available split-pane fallback; AD-043 documents the new default. Editor feature owns the decoration plugins; preview pipeline is reused unchanged.

### AD-044: Inbox-as-vault-root + tray quick-capture (2026-05-10)

**Decision:** F17 treats the vault root as the canonical `Inbox/` (visible as "Inbox" in the Folders drawer). New notes default there unless a folder is selected as the active target. A macOS tray icon + `CmdOrCtrl+Shift+I` global shortcut create an Inbox note from anywhere; closing the window hides it rather than quits.
**Reason:** Root quickly became a junk drawer with no semantic meaning; tray capture removes friction for the "I just remembered something" use case the user kept hitting.
**Trade-off:** Inbox path and shortcut are hard-coded in v1; Settings-level configuration deferred. Drag-and-drop folder moves still go through Bulk Ops — `NoteMetaPanel` folder selector covers the in-note path.
**Impact:** Folder drawer no longer shows "Root"; new system-tray module owns global-shortcut wiring and lifecycle.

### AD-045: Local git history sidebar without remote (2026-05-10)

**Decision:** F18 ships per-vault git auto-commit (5 s debounce) and a `NoteHistory` panel in `NoteMetaPanel` that lists up to 30 recent commits touching the open note with a "Restore" affordance. Uses the system `git` binary (shell-out) — no `git2`/libgit2 dependency. Silently degrades when `git` is missing.
**Reason:** Power users repeatedly hit the "I deleted/overwrote a paragraph" failure mode; shelling out to `git` matches DEFERRED §D2 sketch and avoided pulling in libgit2 + its bundle weight.
**Trade-off:** No diff view in v1 (text-only restore); no remote push (F26 owns that path separately).
**Impact:** Added `src-tauri/src/vcs/` module; `NoteMetaPanel` gains a History section (then folded under F32's Inspector restructure).

### AD-046: Calendar surface as a top-level Rail view (2026-05-11)

**Decision:** F19 adds a calendar/agenda screen as a peer of Home (not a drawer). Month grid + agenda side panel; daily notes and notes with `event:` frontmatter populate day cells.
**Reason:** Daily notes already existed (F10) but had no surface for "what was on this day?" — a month grid was the cheapest way to expose them and unlocked the F31 triage tool-overlay carve-out.
**Trade-off:** No Google Calendar sync, no week/day views — those stay in DEFERRED §D1 until proven necessary.
**Impact:** Shell view router gains `{ kind: "calendar" }`; F31 routes it via the tool-overlay so triage's third column survives.

### AD-047: Triage hides app chrome to match the prototype (2026-05-13)

**Decision:** Inside `layout.mode = "triage"`, the app rail and TopBar are hidden; NavPane owns the brand, the New-note CTA, the folder navigation, the settings gear, and the footer. Graph / Calendar / Todos no longer replace column 3 — they layer in via a tool-overlay store. Focus mode is untouched.
**Reason:** The prototype the user keeps validating against has neither rail nor topbar in triage; shipping them was the single biggest visual regression flagged.
**Trade-off:** Two distinct chrome topologies must be kept in sync (rail+topbar vs. NavPane-owned); some shortcuts must dispatch via NavPane buttons in triage.
**Impact:** F31 owns the rework. AD-026 (temporary folder seams in shell) is partially superseded by NavPane reclaiming those rows.

### AD-048: Inspector restructured into 4 ordered sections (2026-05-13)

**Decision:** F32 collapses the right-side meta panel into exactly four sections in a fixed order: **Outline / Properties / AI / History**. The panel is collapsible from the header. Tag list in NavPane gets a resilient client-side fallback while the index is still building. The ⌘K chip stops using a hard-coded `bg-white` so it reads in dark mode.
**Reason:** The user described the previous stack as a "flat pile of widgets"; Tolaria-style icon-labeled section headers with consistent denser typography read better and let the AI cards live next to Properties without dominating.
**Trade-off:** Re-ordering shipped sections forced a small wave of test updates; the inspector is now a single component tree rather than a free-form column.
**Impact:** Replaces the per-section ad-hoc layout from F08/F18/F22. Future right-panel additions must declare which of the four sections they extend.

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
- **L-013:** Parser parity is more robust when Markdown extensions expose stable semantic tokens rather than comparing renderer-specific HTML across different parser stacks.
- **L-014:** Browser tests must guard Tauri event listeners behind `window.__TAURI_INTERNALS__`; otherwise jsdom shells report unhandled rejections from `@tauri-apps/api/event`.
- **L-015:** macOS Keychain + `gh` credential helper override per-repo `extraheader` PATs at a layer below `GIT_CONFIG_NOSYSTEM` and isolated `$HOME` — symptom is HTTP 403 with the PAT showing as "never used" on GitHub. Solution is to abandon HTTPS+PAT, not to keep patching git transport.
- **L-016:** Corporate / coffee-shop networks frequently block outbound port 22 — `ssh.github.com:443` is the documented escape hatch and should be the default fallback in any tool that uses git over SSH.
- **L-017:** Long-running CLI subprocesses (Claude / Copilot) buffer stdout in non-interactive mode, so "stream the output as it arrives" is not actually available — the cheap, robust pattern is to dispatch the call in the background and surface progress via toasts.
- **L-018:** Three-column "triage" layouts feel cramped under ~1100px; a viewport guardrail that silently downgrades to a single-column focus mode is more user-friendly than letting the panels collapse.
- **L-019:** A "deferred to v2" line in the original vision (dark theme, in our case) is not a guarantee — once token plumbing is variable-based the cost can drop low enough that shipping early is the right call.
- **L-020:** Single-pane WYSIWYG-feel can be achieved on raw CodeMirror 6 with decoration plugins that hide markers when the caret leaves the line, no block-editor migration required.
- **L-021:** Shelling out to the system `git` binary keeps Local History bundle-cheap; libgit2 (`git2` crate) was tempting but added megabytes for no user-visible win.
- **L-022:** When a chrome topology has two valid shapes (rail+topbar vs. NavPane-owned), build the shared body components first and let chrome composition diverge; otherwise you end up duplicating drawer / palette wiring across modes.
- **L-023:** Tag list rendering must not assume the index has emitted its first `index:updated` event before the component subscribes — derive a fallback from open buffer + recent notes, then reconcile when the real list arrives.

---

## Quick Tasks Completed

| #   | Description                                                                                                                                                   | Date       | Commit   | Status     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- | ---------- |
| 001 | Initialize project (.specs/project)                                                                                                                           | 2026-05-06 | —        | ✅ Done    |
| 002 | Build layout playground (3 layouts)                                                                                                                           | 2026-05-06 | —        | ✅ Done    |
| 003 | Refine Layout C (drawers + home)                                                                                                                              | 2026-05-06 | —        | ✅ Done    |
| 004 | Lock Layout C and write multi-agent plan                                                                                                                      | 2026-05-06 | —        | ✅ Done    |
| 005 | Author specs/design/tasks for F01–F10                                                                                                                         | 2026-05-06 | —        | ✅ Done    |
| 006 | Author AGENTS.md (multi-agent contract)                                                                                                                       | 2026-05-06 | —        | ✅ Done    |
| 007 | Reflect 123 atomic tasks into SQL todos with deps                                                                                                             | 2026-05-06 | —        | ✅ Done    |
| 008 | Author F11–F14 (assets, folder ops, settings, markdown ext.) + mini-tasks F05-T18 / F04-T14                                                                   | 2026-05-06 | —        | ✅ Done    |
| 009 | Implement F01 Foundation (Tauri + React + tooling + CI + legacy migration); typecheck/lint/test/build/cargo test/e2e all green                                | 2026-05-06 | —        | ✅ Done    |
| 010 | Implement F02 Vault FS (typed IPC, Rust vault IO/list/watch, vault store, legacy UI bridge, E2E fixture flow)                                                 | 2026-05-06 | f68ef01  | ✅ Done    |
| 011 | Implement F03 Index (SQLite schema/migrations, Rust+TS markdown parser parity, worker, IPC, store/UI integration, crash safety)                               | 2026-05-06 | de3de18  | ✅ Done    |
| 012 | Implement F04 Shell (Zustand shell store, rail/topbar/drawers, cmdk palette, shortcuts/help/toasts, empty state, router, window-state, E2E)                   | 2026-05-06 | multiple | ✅ Done    |
| 013 | Partially land F12 Folder Ops & Bulk Operations (folder/bulk IPC, legacy folder UI, drag/drop, bulk selection, auto-close, E2E); T10 deferred pending F09-T03 | 2026-05-06 | multiple | ✅ Partial |
| 014 | Partially implement F11 Asset Pipeline (asset DB/walker, scoped protocol, attachment IPC, resolver/url/open helpers); T07/T09/T10/T11/T12 deferred to F05/F10 | 2026-05-06 | multiple | ✅ Partial |
| 015 | Implement F07 Drawers (FTS search, folders, recent, starred, tags, a11y, E2E)                                                                                 | 2026-05-06 | multiple | ✅ Done    |
| 016 | Implement F05 Editor (CM6, autosave/conflicts, Markdown preview, Shiki/KaTeX/Mermaid, completions, split view, search, chaos E2E)                             | 2026-05-06 | multiple | ✅ Done    |
| 017 | Implement F06 Home Dashboard (query-backed hero, pinned/recents/tags/all notes, pin flow E2E)                                                                 | 2026-05-06 | multiple | ✅ Done    |
| 018 | Implement F08 Note View + Meta Panel (store, outline/backlinks/hooks, responsive meta panel, NoteView composition)                                            | 2026-05-06 | multiple | ✅ Done    |
| 017 | Complete F11 remaining asset pipeline tasks (preview image rendering, CM6 image drop/paste, drop-render E2E); T11 deferred pending F10-T11                    | 2026-05-06 | multiple | ✅ Partial |
| 019 | Complete F10 vault management (close/recent, switcher, per-vault config, switch chaos E2E) plus unblock F11 attachments config and F12 topbar rename          | 2026-05-06 | multiple | ✅ Done    |
| 020 | Implement F14 Markdown Extensions (callouts, footnotes, highlights, semantic parser parity, CM6 decorations)                                                  | 2026-05-06 | multiple | ✅ Done    |
| 021 | Implement F13 Settings + Search + App Menu (settings panel rows, in-note search, native menu, window recovery, about/diagnostics/shortcuts)                   | 2026-05-06 | multiple | ✅ Done    |
| 022 | Implement F21 AI infrastructure (skills loader, BLAKE3 cache, telemetry, runner)                                                                              | 2026-05-07 | multiple | ✅ Done    |
| 023 | Implement F22 Insights sidebar + remove F20 chat                                                                                                              | 2026-05-07 | cf589a7  | ✅ Done    |
| 024 | Implement F23 Generate-note-from-topic (palette + modal + background runner)                                                                                  | 2026-05-07 | a77c057  | ✅ Done    |
| 025 | Implement F24 AI slash commands (`/ai-summarize`, `/ai-rephrase`, `/ai-expand`, `/ai-continue`)                                                               | 2026-05-07 | e6a4b3e  | ✅ Done    |
| 026 | Per-skill `timeout_secs` + background generate-note with sonner toasts                                                                                        | 2026-05-07 | d95bec1  | ✅ Done    |
| 027 | Implement F25 per-vault Todos (TodosView, palette, shortcut, tray, rail icon)                                                                                 | 2026-05-07 | multiple | ✅ Done    |
| 028 | Implement F26 GitHub sync — backend + frontend (initial PAT path, later removed)                                                                              | 2026-05-07 | 1b6b3d4  | ✅ Done    |
| 029 | F26 hardening — SSH Deploy Key + ssh.github.com:443 fallback + sweep-on-sync + structured commits                                                             | 2026-05-07 | multiple | ✅ Done    |
| 030 | Implement F28 Dual layout modes (Focus + Triage) with viewport guardrail and Cmd+Shift+M shortcut                                                             | 2026-05-07 | multiple | ✅ Done    |
| 031 | Implement F29 Home polish (denser cards, hero CTA, 2-col all-notes, pending-todos card)                                                                       | 2026-05-07 | multiple | ✅ Done    |
| 032 | Implement F30 First-run vault scaffold (Welcome / Daily / Projects / Meetings / Cheatsheet + starter todos, idempotent marker)                                | 2026-05-07 | 1642636  | ✅ Done    |
| 033 | SDD audit — backfill F22/F23/F24/F25/F27 specs, mark M6/M6.5/M7 features in roadmap, log AD-037..AD-041 + L-015..L-018                                        | 2026-05-07 | —        | ✅ Done    |
| 034 | Implement F15 Theme Switching (Light / Dark / System runtime + Shiki swap + menu/palette toggle)                                                              | 2026-05-09 | c5bf2f7+ | ✅ Done    |
| 035 | Implement F16 Live Preview Editor (CM6 decorations conceal inline markers; split-pane retained for blocks)                                                    | 2026-05-09 | d11c41a  | ✅ Done    |
| 036 | Implement F17 Inbox + tray quick-capture + in-note folder move + close-to-tray                                                                                | 2026-05-10 | multiple | ✅ Done    |
| 037 | Implement F18 Local Git Sync v0+v1 (vault git init, auto-commit on save, `NoteHistory` restore panel)                                                         | 2026-05-10 | bddd282+ | ✅ Done    |
| 038 | Implement F19 Calendar / Agenda View (Rail entry, month grid, agenda panel, daily-note + event indicators)                                                    | 2026-05-11 | 4705a25+ | ✅ Done    |
| 039 | Land F31 Triage fidelity rework (hide rail+topbar in triage, NavPane brand/CTA/footer, enriched ListPane, tool-overlay carve-out, splitter polish)            | 2026-05-13 | multiple | ✅ Done    |
| 040 | Implement F32 Inspector redesign (Outline/Properties/AI/History sections, collapsible panel, tag-list fallback, dark-mode ⌘K chip fix)                        | 2026-05-13 | 69033b5+ | ✅ Done    |
| 041 | Spec alignment sweep — refresh ROADMAP/STATE/STRUCTURE/ARCHITECTURE/CONCERNS/STACK/DEFERRED to match shipped state (M0–M8 done, M9 in flight)                 | 2026-05-14 | —        | ✅ Done    |
| 042 | Close F31 (NavPane footer path+count, palette Tools section + open-calendar, ⌘⇧C shortcut, design.md/tasks.md authored, F31 → COMPLETE, M9 → COMPLETE)        | 2026-05-15 | —        | ✅ Done    |

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
- **AD-022**: F26 GitHub sync — PAT-via-extraHeader path is functional for plain environments but **does not work reliably on macOS** when the user has Apple Command Line Tools git + osxkeychain + gh credential helpers installed (libcurl appears to short-circuit auth via Keychain at a layer below `GIT_CONFIG_NOSYSTEM`/isolated `$HOME`). Symptom: PAT shows as "never used" on GitHub, push fails with `RPC failed; HTTP 403 ... send-pack: unexpected disconnect`. Hotfix attempts exhausted. Decision: keep PAT path as best-effort + ship an alternative auth mechanism in a follow-up feature. Recommended: GitHub Contents API (REST) with OAuth Device Flow, since auth is then in our HTTP client and bypasses git transport entirely. SSH Deploy Key is a viable fallback. Track as F27 in roadmap.

---

## Preferences

**Model Guidance Shown:** never
