# Roadmap

**Current Milestone:** M1 — Vault & Index
**Status:** F13 complete; M5 polish settings/search/menu shipped

Status legend: `PLANNED` · `IN PROGRESS` · `COMPLETE` · `DEFERRED`

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
- Migrate `/prototype` Layout C into the real app's `src/`

---

## M1 — Vault & Index

**Goal:** Open a folder, list `.md` files, react to external changes, and have a queryable SQLite index of notes, tags, and wikilinks.

### Features

**[F02 — Vault FS](../features/F02-vault-fs/spec.md)** — COMPLETE

- Open vault (folder picker), persist recent vaults
- Read/write `.md` files via Rust IPC
- File watcher (Rust `notify`) emitting Tauri events to frontend

**[F03 — Index (SQLite)](../features/F03-index/spec.md)** — COMPLETE

- SQLite schema: `notes`, `links`, `tags`, `note_tags`
- Markdown parser (Rust `pulldown-cmark`) extracting title, tags, wikilinks
- Incremental indexer reactive to file watcher events
- Frontend IPC client + Zustand store fed by index

---

## M2 — Shell (Layout C)

**Goal:** The Layout C UI from the prototype, fully wired to the real app skeleton, but rendering empty/placeholder data.

### Features

**[F04 — Shell](../features/F04-shell/spec.md)** — COMPLETE

- Slim icon rail
- Top bar with breadcrumb, ⌘K trigger, Nova nota
- Drawer container (Search/Folders/Recent/Starred/Tags routes)
- Command palette modal (⌘K)
- View router: `home` ↔ `note(id)`
- Keyboard shortcuts wiring

---

## M3 — Editor & Note view

**Goal:** Open a note from Home, see the editor, edit, autosave, navigate via wikilinks.

### Features

**[F05 — Editor](../features/F05-editor/spec.md)** — COMPLETE

- CodeMirror 6 setup (markdown lang, theme, save-on-change debounced)
- Shiki-powered code blocks in preview
- KaTeX math rendering
- Mermaid diagram rendering
- Task list rendering (`- [ ] / - [x]`)
- Wikilink autocomplete in editor

**[F08 — Note view + Meta panel](../features/F08-note-view/spec.md)** — COMPLETE

- Note layout (editor + right meta)
- Right panel: Outline, Backlinks, Recents
- Breadcrumb + Back-to-Home in top bar
- AI suggestion card (UI stub only)

**[F09 — Wikilinks & Backlinks](../features/F09-wikilinks-backlinks/spec.md)** — COMPLETE

- Wikilink resolution (title → note id) via index
- Click-to-navigate
- Create-on-click for missing notes
- Backlinks query + panel data

**[F11 — Assets & Images](../features/F11-assets-images/spec.md)** — COMPLETE

- Tauri `asset://` protocol w/ runtime-scoped vault path
- `assets` SQLite table populated by extended F02 walker
- Inline image rendering (`![[image.png]]` and `![alt](path)`)
- Drop / paste image → write into attachments folder
- Click non-image asset opens with OS handler (safelist + confirm)

**[F12 — Folder Ops & Rename UX](../features/F12-folder-ops/spec.md)** — COMPLETE

- `folders.create/rename/move/trash` IPC
- FoldersDrawer context menu + inline rename
- Drag-and-drop notes between folders (`@dnd-kit/core`)
- Inline rename of active note in TopBar
- Bulk selection (Shift/⌘ click) + bulk move/delete/tag/pin/star

---

## M4 — Discovery surfaces

**Goal:** Home dashboard and all 5 drawers powered by the index.

### Features

**[F06 — Home Dashboard](../features/F06-home/spec.md)** — COMPLETE

- Hero (greeting + counts + "Abrir nota de hoje")
- Pinned grid
- Recents list
- By Tag pills
- All Notes grid

**[F07 — Drawers](../features/F07-drawers/spec.md)** — COMPLETE

- Drawer container & open/close from rail
- Search drawer (full-text via SQLite FTS5)
- Folders drawer (tree)
- Recent drawer
- Starred drawer
- Tags drawer

---

## M5 — Polish

**Goal:** Daily notes, multi-vault, settings — everything else the mock implies.

### Features

**[F10 — Daily Notes & Multi-vault](../features/F10-daily-multivault/spec.md)** — COMPLETE

- Daily note creation + template
- Multi-vault list & switcher
- Active-vault persistence

**[F13 — Settings + In-note Search + App Menu](../features/F13-settings-search-menu/spec.md)** — COMPLETE

- Settings panel (General/Editor/Files/Markdown/Daily/Advanced)
- Per-vault overrides in `<vault>/.noxe/config.json`
- ⌘F / ⌘⇧F via `@codemirror/search`
- Native OS menubar (Tauri 2 menu API)
- `tauri-plugin-window-state` window persistence + off-screen recovery
- About + diagnostics + shortcuts list

**[F14 — Markdown Extensions](../features/F14-markdown-extensions/spec.md)** — COMPLETE

- Obsidian-style callouts (`> [!note]` etc.)
- Footnotes (`[^1]`)
- Highlight (`==text==`)
- Parity gate extended for both Rust + TS pipelines
- CM6 decorations for callout/footnote markers

---

## M6 — Contextual AI

**Goal:** Replace the generic AI chat panel with three tightly integrated AI features the user actually reaches for: passive insights on the open note, generation from a topic, and slash-commands inside the editor. All built on a small skills + cache + telemetry foundation.

### Features

**[F20 — AI Chat Panel](../features/F20-ai-chat/spec.md)** — SUPERSEDED by F21–F24

- Generic right-side chat panel scoped to the open note. Shipped, then deprecated when we realised the user already has `claude` / `copilot` CLIs for free-form Q&A. Spec stays as historical reference.

**[F21 — AI Infrastructure](../features/F21-ai-infrastructure/spec.md)** — COMPLETE

- Skills system: bundled defaults + `~/.noxe/skills/*.md` overrides
- BLAKE3 content-hash cache (`ai_cache` table)
- Telemetry (`ai_calls` table) + Settings → AI → Usage
- `ai_run_skill` runner orchestrates skill → cache → subprocess
- Removes the F20 chat UI (low-level subprocess primitive stays)

**[F22 — Insights sidebar](../features/F22-ai-insights/spec.md)** — COMPLETE

- Three on-demand cards on note view (Summary / Suggested tags / Related notes), each opt-in, cached via F21
- Related-notes resolves LLM titles back to real vault notes via the index
- Removed the F20 chat panel + rail button

**[F23 — Generate note from topic](../features/F23-generate-note/spec.md)** — COMPLETE

- Command palette entry + modal (topic + optional folder)
- Background generation with sonner toast; per-skill `timeout_secs` for longer drafts
- Disabled-AI state shows Settings link instead of input

**[F24 — Slash commands](../features/F24-slash-commands/spec.md)** — COMPLETE

- `/ai-summarize`, `/ai-rephrase`, `/ai-expand`, `/ai-continue` in CodeMirror slash menu
- Single undoable replace edit per command; failures preserve original text
- Disabled-AI state surfaces a toast instead of running

---

## M6.5 — Productivity surfaces

**Goal:** Add lightweight productivity capture on top of the AI features so daily workflows live inside the app.

### Features

**[F25 — Per-vault Todos](../features/F25-todos/spec.md)** — COMPLETE

- `<vault>/.noxe/todos.json` store + dedicated TodosView
- Side rail icon, Cmd+Shift+T global shortcut, system tray entry
- Cmd+K palette: open todos searchable + "Create todo" fallback
- Pending-todos card on Home (refined under F29)

---

## M7 — Sync, layout & onboarding

**Goal:** Make the app usable across machines, configurable for two work modes, and welcoming on first run.

### Features

**[F26 — GitHub sync](../features/F26-github-sync/spec.md)** — COMPLETE

- Per-vault GitHub remote synced over SSH with `ssh.github.com:443` auto-fallback
- Full vault sweep on every commit (notes, frontmatter, todos, settings, attachments) — not only the actively edited note
- Structured commit messages: Conventional Commits style + ISO timestamp + file-list trailer + `Source: noxe-app`
- Conflict-as-copy resolution (no merge UX)

**[F27 — Cross-account sync auth pivot](../features/F27-cross-account-sync-pivot/spec.md)** — ABSORBED INTO F26

- HTTPS+PAT path removed entirely after macOS Keychain / `gh` helpers proved un-bypassable
- SSH Deploy Key + `ssh.github.com:443` chosen as the single sanctioned path
- `gh`-CLI auto-create removed; user creates the empty repo and pastes the SSH URL

**[F28 — Dual layout modes (Focus + Triage)](../features/F28-dual-layout-modes/spec.md)** — COMPLETE

- New `layout.mode` setting (`focus` = current 2-col; `triage` = 3-col nav + list + view)
- Cmd+Shift+M toggle (Cmd+Shift+L stays bound to theme cycle)
- Custom Splitter, NavPane, ListPane, TriageBody components; Rail buttons mode-aware
- Auto-fallback to `focus` on viewports < 1100px (prevents cramped triage)

**[F29 — Home polish](../features/F29-home-polish/spec.md)** — COMPLETE

- Denser NoteCard with tag pills; HomeHero with primary CTA; AllNotesGrid 2-col compact
- Pending-todos card surfaced on Home; AllNotes hidden behind a toggle to keep Home short

**[F30 — Onboarding scaffold](../features/F30-onboarding-scaffold/spec.md)** — COMPLETE

- New vaults seeded with Welcome.md / Daily / Projects / Meetings / Cheatsheet + 3 starter todos
- Idempotent via `.noxe/scaffold.json` marker; respects pre-existing files

---

## M8 — Release prep (post-mock)

**Goal:** Cross-platform build pipeline, icons, branding, public v1 release. Specs to be written when M5/M6/M7 land.

### Features

- Tauri release config (signing, updater) — PLANNED
- App icons + branding — PLANNED
- Crash/error reporting (opt-in) — PLANNED

---

## Future Considerations (deferred from v1)

- **Graph view** — interactive node-link visualization
- **Sync (E2E)** — Yjs/Automerge over self-hostable backend
- **Git-as-backend** — alternative sync path
- **Real AI** — semantic search, RAG chat, real link suggestions
- **Mobile** (Capacitor / React Native) and **Web** targets
- **Importers** — Obsidian, Inkdrop, Notion
- **Executable code blocks** (notebook mode)
- **Plugin / extensibility API**
- **Public link sharing / collaboration**
- **Dark theme**
