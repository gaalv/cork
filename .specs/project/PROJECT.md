# Noxe

**Vision:** A local-first Markdown notes app for developers — Obsidian's data ownership and connected knowledge with Inkdrop's polished UX, packaged in a focused, command-driven shell.
**For:** Developers and technical knowledge workers who want full control of their notes (`.md` on disk) with a first-class editor and frictionless navigation.
**Solves:** Existing tools force a tradeoff. Obsidian is powerful but plugin-dependent; Inkdrop is polished but proprietary and lacks deep linking. Noxe ships both natively: pure `.md` files as source of truth + dev-grade editor + wikilinks/backlinks/graph + a minimal, command-first UI.

## Goals

- Ship a desktop MVP where a user can open a folder of `.md` files and edit, link, and navigate them with zero friction. Done = Home → open note → edit → wikilink → backlink → command palette all work end-to-end.
- Match or exceed Inkdrop-level editor polish for code-heavy notes (Shiki highlighting, Mermaid, KaTeX, task lists, code blocks rendered inline).
- Keep the vault format 100% portable: every note must remain readable/editable by Obsidian or any plain-text editor (no proprietary metadata in note bodies).

## Tech Stack

Aligned with [Tolaria](https://github.com/refactoringhq/tolaria).

**Core:**

- Runtime: **Tauri 2** (Rust backend + system WebView)
- Language: **TypeScript 5.9** (frontend), **Rust stable** (backend)
- Frontend: **React 19** + **Vite 7**
- Styling: **Tailwind CSS v4** (`@theme` tokens, no separate config file)
- Editor: **CodeMirror 6**
- Index/metadata: **SQLite** (via `rusqlite` in `src-tauri`, lives in app data dir)
- Package manager: **pnpm** (via corepack, locked to a recent version)

**Key dependencies:**

- `@phosphor-icons/react` + `lucide-react` — icon sets
- `react-markdown` + `remark-gfm` + `rehype-highlight` (Shiki theme) — preview render pipeline
- `katex` — math rendering
- `mermaid` — diagrams
- `pulldown-cmark` (Rust) — server-side parsing for the SQLite index (fast, no JS runtime cost)
- `notify` (Rust) — vault file watcher
- `zustand` — frontend cross-cutting state (active vault, recents)
- `@radix-ui/react-*` — accessible primitives (dialog, dropdown, tooltip)

**Testing:**

- **Vitest** + **React Testing Library** — unit/component
- **Playwright** — smoke + E2E (Tauri dev mode)

## UI / Layout

**Layout C — Minimal + Command (locked).** See `.specs/features/F04-shell/spec.md` for the complete description.

Surfaces:

- **Slim icon rail** (left, 56px) — Home + drawers (Search, Folders, Recent, Starred, Tags) + AI/Settings.
- **Top bar** — breadcrumb / "← Home" when in a note, command palette trigger (⌘K), "Nova nota".
- **Home dashboard** (default view) — Pinned · Recents · By Tag · All notes.
- **Drawers** (~300 px) — slide between rail and main when invoked from rail.
- **Note view** — centered editor (max 740 px) + right meta panel (Outline, Backlinks, Recents).
- **Command palette** — modal overlay, primary navigation device.

Theme: light by default; dark deferred to v2.

## Scope

**v1 includes (mapped to mocked layout):**

- Local vault (open folder, multi-vault switch)
- File watcher for external changes
- SQLite index of notes/tags/wikilinks
- CodeMirror 6 editor with markdown mode
- Live preview with Shiki, KaTeX, Mermaid, task lists, wikilink rendering
- Wikilinks `[[note]]` with autocomplete + click-to-navigate + create-on-click
- Backlinks panel (right meta)
- Outline panel (right meta)
- Tags (flat + hierarchical `#dev/rust`)
- Command palette (notes search, commands)
- Drawers (Search, Folders, Recent, Starred, Tags)
- Home dashboard (Pinned, Recents, By Tag, All Notes)
- Daily notes (button + template)
- Multi-vault switch
- AI suggestion card on note view (UI stub only — no real AI in v1)
- Desktop only (macOS, Windows, Linux via Tauri)

**Explicitly out of scope for v1:**

- Sync (E2E, self-hosted backend, Git-as-backend)
- Real AI features (semantic search, RAG chat, link suggestions backed by an LLM) — UI stub stays
- Graph view (deferred to v2)
- Mobile and Web targets
- Importers (Obsidian, Inkdrop, Notion)
- Plugin / extensibility API
- Executable code blocks (notebook mode)
- Public link sharing / collaboration
- Dark theme

## Constraints

- **Format:** vault stays pure `.md`. SQLite index lives in app data dir, not in vault.
- **Performance:** desktop bundle size and cold-start time matter (Tauri chosen over Electron). Avoid heavy runtime deps in the WebView.
- **Resources:** solo / small-team. Prioritize features with the highest UX leverage; defer anything requiring backend infra.
- **Multi-agent ready:** every feature lives in `.specs/features/Fxx-*/` with `spec.md`, `design.md`, `tasks.md`. Each task is atomic, traceable to a requirement ID, and committable independently. See [`AGENTS.md`](../../AGENTS.md).
