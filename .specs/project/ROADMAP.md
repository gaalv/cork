# Roadmap

**Current Milestone:** M10 — Release prep
**Status:** M0–M8 complete; M9 partially complete; M10 in progress; M11 planned; M12 (Templates & lifecycle) and M13 (Sync resilience) planned — both may execute ahead of M11 (smaller scope; M13 fixes a live defect)

**Product arc:** v1 (desktop MVP) → v2 (CRDT real-time sync) → v3 (graph + deep AI) → future (mobile, plugins, hosted relay). See `PROJECT.md §Long-term Direction` and `§Strategic Decisions` for rationale.

**Prioritization principles:**

1. Ship v1 first — nothing else matters until the app is in users' hands
2. Sync unlocks growth — multi-device is the #1 request for every notes app; v2 is sync
3. AI is a differentiator, not the product — keep it contextual and grounded
4. Desktop before mobile — get the core right on one platform first
5. Community before revenue — build trust and adoption first

Status legend: `PLANNED` · `IN PROGRESS` · `COMPLETE` · `PARTIAL` · `DEFERRED` · `SUPERSEDED`

---

## M0 — Foundation

**Goal:** A Tauri shell that builds and runs cross-platform with the locked stack, lint+test+CI green.

### Features

**[F01 — Foundation](../features/F01-foundation/spec.md)** — COMPLETE

- Tauri 2 + Rust scaffold + IPC contract skeleton
- Vite 7 + React 19 + TypeScript strict + Tailwind v4
- ESLint flat config + Prettier
- Vitest + React Testing Library + Playwright
- GitHub Actions CI: lint, typecheck, test, smoke build

---

## M1 — Vault & Index

**Goal:** Open a folder, list `.md` files, react to external changes, and have a queryable SQLite index of notes, tags, and wikilinks.

### Features

**[F02 — Vault FS](../features/F02-vault-fs/spec.md)** — COMPLETE

- Open vault (folder picker), persist recent vaults
- Read/write `.md` files via Rust IPC
- File watcher (Rust `notify`) emitting Tauri events to frontend

**[F03 — Index (SQLite)](../features/F03-index/spec.md)** — COMPLETE

- SQLite schema: `notes`, `links`, `tags`, `note_tags`, `assets`
- Markdown parser (Rust `pulldown-cmark`) extracting title, tags, wikilinks
- Incremental indexer reactive to file watcher events
- Frontend IPC client + Zustand store fed by index

---

## M2 — Shell

**Goal:** The app shell with navigation, command palette, and note editing surface.

### Features

**[F04 — Shell](../features/F04-shell/spec.md)** — COMPLETE (layout diverged from original spec)

- ~~Rail + TopBar layout (original Layout C)~~ → Triage 3-column layout (Sidebar + NotesList + EditorPane)
- Command palette modal (⌘K)
- View router + keyboard shortcuts wiring
- StatusBar, EmptyVault, HelpModal

_Note: The original spec described a Rail+TopBar "Layout C" shell. The actual implementation is a Triage layout matching the Linear-style prototype. The spec should be rewritten to match._

---

## M3 — Editor & Note view

**Goal:** Open a note, see the editor, edit, autosave, navigate via wikilinks.

### Features

**[F05 — Editor](../features/F05-editor/spec.md)** — COMPLETE

- CodeMirror 6 setup (markdown lang, theme, save-on-change debounced)
- Markdown preview (split pane)
- Wikilink autocomplete in editor
- Editor toolbar, save indicator, conflict banner

**[F08 — Note view + Meta panel](../features/F08-note-view/spec.md)** — COMPLETE

- ~~Dedicated NoteView layout wrapper~~ → EditorPane in triage serves as note view
- Inspector panel: Outline, Tags, Properties, Backlinks, AI sections
- ~~Breadcrumb + Back-to-Home in top bar~~ → not applicable in triage layout
- ~~AI suggestion card stub~~ → replaced by F32 Inspector AI section

**[F09 — Wikilinks & Backlinks](../features/F09-wikilinks-backlinks/spec.md)** — COMPLETE

- Wikilink resolution (title → note id) via index
- CM6 decorations + click-to-navigate
- Create-on-click for missing notes
- Backlinks query + Inspector section

**[F11 — Assets & Images](../features/F11-assets-images/spec.md)** — COMPLETE

- ✅ Tauri `asset://` protocol w/ runtime-scoped vault path
- ✅ `assets` SQLite table populated by extended F02 walker
- ✅ Backend IPC commands + frontend ingest service
- ✅ Drop / paste image UI in editor (CM6 drop/paste handler)
- ✅ Inline image rendering in editor (CM6 block widget) + preview (rehype plugin)

**[F12 — Folder Ops & Rename UX](../features/F12-folder-ops/spec.md)** — COMPLETE

- `folders.create/rename/move/trash` IPC
- Drag-and-drop notes between folders
- Inline rename, bulk selection + bulk move/delete/tag/pin

---

## M5 — Polish

**Goal:** Settings, search, markdown extensions.

### Features

**[F13 — Settings + In-note Search + App Menu](../features/F13-settings-search-menu/spec.md)** — COMPLETE

- Settings panel (General/Editor/Files/Markdown/Daily/Advanced)
- Per-vault overrides in `<vault>/.cork/config.json`
- ⌘F / ⌘⇧F via `@codemirror/search`
- Native OS menubar (Tauri 2 menu API)
- `tauri-plugin-window-state` window persistence + off-screen recovery

**[F14 — Markdown Extensions](../features/F14-markdown-extensions/spec.md)** — PARTIAL

- ✅ Parser extracts callouts, footnotes, highlight (`==text==`) for indexing
- ✅ Settings toggles for each extension
- ❌ CM6 rendering decorations for callouts/footnotes/highlights — not implemented
- ❌ Preview rendering of extensions — not implemented

---

## M6 — Contextual AI

**Goal:** AI infrastructure + contextual AI features built on local CLI subprocesses.

### Features

**[F20 — AI Chat Panel](../features/F20-ai-chat/spec.md)** — SUPERSEDED by F21–F23

- Generic chat panel — never shipped or removed. Spec stays as historical reference.

**[F21 — AI Infrastructure](../features/F21-ai-infrastructure/spec.md)** — COMPLETE

- Skills system: bundled defaults + `~/.cork/skills/*.md` overrides
- BLAKE3 content-hash cache (`ai_cache` table)
- Telemetry (`ai_calls` table) + Settings → AI → Usage
- `ai_run_skill` runner orchestrates skill → cache → subprocess

**[F23 — Generate note from topic](../features/F23-generate-note/spec.md)** — COMPLETE

- Command palette entry + modal (topic + optional folder)
- Background generation with sonner toast; per-skill `timeout_secs` for longer drafts
- Disabled-AI state shows Settings link instead of input

---

## M7 — Sync, layout & onboarding

**Goal:** Make the app usable across machines and welcoming on first run.

### Features

**[F26 — GitHub sync](../features/F26-github-sync/spec.md)** — COMPLETE

- Per-vault GitHub remote synced with repo-scoped HTTPS PAT auth (SSH Deploy Key as fallback)
- Full vault sweep on every commit (notes, frontmatter, settings, attachments)
- Structured commit messages: Conventional Commits + ISO timestamp + file-list trailer
- Conflict-as-copy resolution (no merge UX)
- Heartbeat pull worker (12s cycle)

**[F27 — Cross-account sync auth pivot](../features/F27-cross-account-sync-pivot/spec.md)** — ABSORBED INTO F26

**[F30 — Onboarding scaffold](../features/F30-onboarding-scaffold/spec.md)** — COMPLETE

- New vaults seeded with Welcome.md, README, starter folders
- Idempotent via `.cork/scaffold.json` marker; respects pre-existing files

---

## M8 — Post-v1 polish

**Goal:** Theming, capture/inbox, local history.

### Features

**[F15 — Theme Switching (Light / Dark / System)](../features/F15-theme-switching/spec.md)** — COMPLETE

- `appearance.theme` setting honoured end-to-end; CSS-variable dark palette
- Settings select + command palette + native menu "Toggle theme" cycle
- System mode reacts to OS `prefers-color-scheme` changes at runtime

**[F17 — Inbox + In-place Moves + Tray Quick Capture](../features/F17-inbox-and-quick-capture/spec.md)** — PARTIAL

- ✅ Canonical `Inbox/` folder as default new-note target
- ✅ macOS tray icon + `CmdOrCtrl+Shift+I` global quick-capture
- ❌ Folder selector in NoteMetaPanel (move-from-inside-the-note) — not implemented
- ❌ Dedicated Inbox view/filter — not implemented

**[F18 — Local Git Sync (v0/v1 local-only)](../features/F18-local-git-sync/spec.md)** — COMPLETE

- ✅ Per-vault `git init` + auto-commit on save (debounced)
- ✅ Silent degrade when `git` is not on PATH
- ✅ Backend: commit history retrieval, restore-to-revision commands
- ✅ NoteHistory UI in Inspector (HistorySection with inline restore confirm)

---

## M9 — Prototype fidelity

**Goal:** Close the gap between shipped UI and the Linear-style prototype.

### Features

**[F31 — Triage layout fidelity](../features/F31-triage-fidelity/spec.md)** — COMPLETE

- Triage body: Sidebar + NotesList + EditorPane + optional InspectorPane
- StatusBar component
- Resizable splitter

**[F32 — Inspector redesign](../features/F32-inspector-redesign/spec.md)** — COMPLETE

- Inspector restructured into five sections: Outline / Tags / Properties / Backlinks / AI
- Collapsible right panel toggled from the header
- Section headers with consistent typography

---

## M10 — Release prep

**Goal:** Cross-platform build pipeline, icons, branding, public v1 release.

### Features

**[F33 — Release config (signing, notarization, updater)](../features/F33-release-config/spec.md)** — PARTIAL

- `tauri-plugin-updater` installed as Rust dependency, **not yet registered**
- ✅ Settings → Updates panel scaffolded
- ❌ macOS/Windows/Linux signing — deferred (needs certs)

**[F34 — App icons + branding](../features/F34-icons-branding/spec.md)** — COMPLETE

- Source SVGs in `brand/`
- Full Tauri icon matrix (icns, ico, PNGs, tray)

**[F35 — Crash + error reporting (opt-in)](../features/F35-crash-reporting/spec.md)** — PARTIAL

- ✅ Always-on local crash log (Rust panic hook + JS error boundary) with rotation
- ✅ Mandatory redactor + Settings → Diagnostics section
- ❌ Remote reporting → deferred to F36

**F36 — Remote crash reporting opt-in** — PLANNED

- Tri-state setting, Sentry endpoint, consent modal
- Inherits F35 redactor unchanged

---

## M11 — Real-time Sync

**Goal:** Multi-device sync that works without conflicts, powered by CRDTs (Yjs) with git as the archive/backup layer.

### Features

**[F37 — CRDT Sync (Yjs + Git)](../features/F37-crdt-sync/spec.md)** — PLANNED

- Yjs `Y.Doc` per note, CM6 bound via `y-codemirror.next`
- Local persistence in `.cork/crdt/` (DiskProvider)
- Periodic flush: CRDT → `.md` → git commit (FlushService)
- WebSocket relay + WebRTC P2P providers
- Awareness protocol: remote cursors + presence
- Standalone `cork-relay` server (self-hostable)

**[F38 — Relay Auth & Identity](../features/F38-relay-auth/spec.md)** — PLANNED

- GitHub OAuth as identity provider for hosted relay (self-hosted keeps shared-secret HMAC)
- Relay issues JWT (Ed25519, 15-min access + 30-day refresh); GitHub token used only for identity, then discarded
- Vault registration on relay (ownership-based room authorization)
- Device management (list/revoke connected devices)
- OS keychain storage for tokens (`keyring` crate)
- Provider-agnostic JWT claims — architecture supports adding passkeys/email later

---

## M12 — Templates & note lifecycle

**Goal:** Start notes from predefined structures and track their lifecycle state; everything stays plain `.md` + frontmatter.

### Features

**[F39 — Note Templates](../features/F39-templates/spec.md)** — COMPLETE (pending user UAT)

- Templates as plain `.md` notes in a configurable `Templates/` vault folder
- 4 default templates seeded by scaffold (create-if-missing, never overwritten)
- Single Rust variable renderer: `{{title}}`, `{{date}}`, `{{time}}`, `{{datetime}}`, `{{cursor}}`
- New note from template + insert template at cursor (shared picker modal via ⌘K)
- Settings → Templates section (folder config, list, "New template")

**[F40 — Note Status](../features/F40-note-status/spec.md)** — COMPLETE (pending user UAT)

- Inkdrop-style per-note status: `active` / `on-hold` / `done`, absent by default
- Plain `status:` frontmatter, mirroring the pinned architecture (AD-053) end-to-end
- NotesList badge, sidebar Status filter group (hidden when unused), context-menu submenu, Inspector selector, palette entries
- No kanban, no due dates, no custom statuses — Cork stays a notes app

---

## M13 — Sync resilience

**Goal:** GitHub sync survives token expiry and transient failures without ever requiring a full re-setup.

### Features

**[F41 — Sync Resilience](../features/F41-sync-resilience/spec.md)** — COMPLETE (T05 expiry-awareness deferred as P3; pending user UAT on live vault)

- Erase-proof credential helper — a spurious 401 (proxy/hibernation) can no longer wipe a valid PAT (git `credential-store` erase semantics were destroying it)
- "Update token" in place — recovery without touching remote/URL/history
- Error classification (auth vs offline) + heartbeat backoff + fetch-failure logging
- Stop committing `.cork/sync.log` (fixes the 12s self-commit loop)
- P3: token expiry capture with pre-expiry warning (incident token had no expiry — low priority)

---

## M14 — Notes-app completeness

**Goal:** Close the table-stakes gaps identified in the 2026-07-24 product review: content search, daily habit, editor rendering parity, export, graph — plus virtualization, archive-first deletion and bundle-budget fixes as quick tasks.

### Features

**[F42 — Full-text Search UI](../features/F42-search-ui/spec.md)** — COMPLETE (pending user UAT)

- Palette "Content matches" section backed by the existing FTS5 `index.search`

**[F43 — Daily Notes](../features/F43-daily-notes/spec.md)** — COMPLETE (pending user UAT)

- `Daily/YYYY-MM-DD.md` flat format (AD-052), template-aware via F39, ⌘⇧T

**[F44 — Editor-side Markdown Extension Rendering](../features/F44-editor-markdown/spec.md)** — COMPLETE (pending user UAT)

- Live-preview decorations for highlights, callouts, code fences, tables (closes the F14 editor half)

**[F45 — Note Export](../features/F45-note-export/spec.md)** — COMPLETE (pending user UAT)

- Self-contained HTML export, PDF via print dialog, copy as Markdown

**[F46 — Graph View](../features/F46-graph-view/spec.md)** — COMPLETE (pending user UAT)

- Canvas force-directed graph over the existing `links.graph` IPC, overlay modal, ⌘⇧G

**[F47 — Calendar](../features/F47-calendar/spec.md)** — PLANNED

- Month-grid overlay from the status bar (like Graph); day markers for daily notes + `ctime` activity; click a day opens/creates its daily note and filters the list to that date. Sidebar stays filters-only; no events/scheduling.

### Quick tasks

- NotesList virtualization (1k-note vaults)
- Archive-first deletion model (Delete leaves the note context menu; Archive is the removal path, permanent delete only from the Archived view)
- Bundle code-splitting to restore the 500 kB budget (CI red since 2026-07-24)

---

## Removed features (specs deleted)

These features had specs marked COMPLETE but were never implemented. They were part of an earlier layout concept (Layout C with Rail + TopBar + Home Dashboard + Drawers) that was replaced by the current Triage layout.

- **F06 — Home Dashboard** — Hero, pinned grid, recents, tag pills. Never built; triage NotesList replaced it.
- **F07 — Drawers** — 5 sidebar drawers. Never built; triage Sidebar replaced them.
- **F10 — Daily Notes & Multi-vault** — Daily note creation, vault switcher. Never built.
- **F16 — Live Preview Editor** — CM6 decoration plugins to hide markdown markers. Never built.
- **F19 — Calendar / Agenda View** — Month grid, agenda panel. Never built.
- **F22 — AI Insights sidebar** — Summary/Tags/Related cards in note meta. Never built.
- **F24 — Slash Commands** — /ai-summarize, /ai-rephrase, etc. in CM6 slash menu. Never built.
- **F29 — Home Polish** — Refinement of F06 which didn't exist. Never built.
- **F25 — Per-vault Todos** — Per-vault todo list with UI and palette. Pivoted away.
- **F28 — Dual Layout Modes** — Focus/Triage toggle. Only Triage was ever built; Focus mode dropped.

---

## Future Considerations (deferred)

- **Home dashboard** — a landing/overview surface (revisit from F06)
- **Daily notes** — daily note creation + template (revisit from F10)
- **Multi-vault switcher** — switch between vaults in-app (revisit from F10)
- **Live preview editor** — WYSIWYG-feel inline markdown (revisit from F16)
- **Calendar / agenda** — month grid with daily notes (revisit from F19)
- **AI insights** — passive note analysis cards (revisit from F22)
- **AI slash commands** — inline editor AI actions (revisit from F24)
- **Graph view** — interactive node-link visualization
- **Real AI** — semantic search, RAG chat, local embeddings
- **Mobile** (Capacitor / React Native) and **Web** targets
- **Importers** — Obsidian, Inkdrop, Notion
- **Executable code blocks** (notebook mode)
- **Plugin / extensibility API**
- **Public link sharing / collaboration**
- **Hosted relay service** — managed Cork Sync (product decision post-F37/F38)
- **E2E encryption** — encrypt CRDT updates before relay transmission
- **Passkey / email auth** — additional identity providers for relay (F38 architecture supports it)
