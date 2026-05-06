# Roadmap

**Current Milestone:** M1 — Vault & Index
**Status:** F03 complete; M1 index shipped

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

**[F13 — Settings + In-note Search + App Menu](../features/F13-settings-search-menu/spec.md)** — PLANNED
- Settings panel (General/Editor/Files/Markdown/Daily/Advanced)
- Per-vault overrides in `<vault>/.noxe/config.json`
- ⌘F / ⌘⇧F via `@codemirror/search`
- Native OS menubar (Tauri 2 menu API)
- `tauri-plugin-window-state` window persistence + off-screen recovery
- About + diagnostics + shortcuts list

**[F14 — Markdown Extensions](../features/F14-markdown-extensions/spec.md)** — PLANNED
- Obsidian-style callouts (`> [!note]` etc.)
- Footnotes (`[^1]`)
- Highlight (`==text==`)
- Parity gate extended for both Rust + TS pipelines
- CM6 decorations for callout/footnote markers

---

## M6 — Release prep (post-mock)

**Goal:** Cross-platform build pipeline, icons, branding, public v1 release. Specs to be written when M5 lands.

### Features

- Tauri release config (signing, updater) — PLANNED
- App icons + branding — PLANNED
- First-run onboarding — PLANNED
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
