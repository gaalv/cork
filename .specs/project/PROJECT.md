# Cork

**Vision:** A local-first Markdown notes app for developers — Obsidian's data ownership and connected knowledge with Inkdrop's polished UX, packaged in a focused, command-driven shell.
**For:** Developers and technical knowledge workers who want full control of their notes (`.md` on disk) with a first-class editor and frictionless navigation.
**Solves:** Existing tools force a tradeoff. Obsidian is powerful but plugin-dependent; Inkdrop is polished but proprietary and lacks deep linking. Cork ships both natively: pure `.md` files as source of truth + dev-grade editor + wikilinks/backlinks/graph + a minimal, command-first UI.

## Core Beliefs

1. **Your notes are yours.** The vault is a folder of `.md` files. Period. No database-as-source-of-truth, no proprietary sync format, no "export" feature needed. Open your vault in Obsidian, VS Code, or `cat` — it just works.
2. **Local-first, sync-optional.** The app works fully offline. Sync is an opt-in layer — git for the version-control-native, CRDT relay for real-time multi-device — never a requirement.
3. **Convention over configuration.** Sensible defaults that work out of the box. Frontmatter fields like `tags:`, `pinned:`, `event:` trigger UI behavior with zero setup.
4. **Developer-grade tools, writer-grade UX.** CodeMirror 6, Shiki, KaTeX, Mermaid — wrapped in a minimal UI that doesn't feel like an IDE.
5. **AI is contextual, not conversational.** No chatbot. AI surfaces insights, suggests tags, generates drafts, and runs editor commands — grounded in vault content, running through local CLI tools.

## What Cork is NOT

- Not a Notion replacement (no databases, no blocks-as-primitives)
- Not a wiki platform (no sharing, no multi-user editing in v1)
- Not an Electron app (Tauri keeps it fast and light)
- Not a plugin ecosystem (focused core; extensibility is a future consideration)

## Inspirations

| App          | What we take                                                           | What we leave                                                       |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Obsidian** | Vault-on-disk philosophy, wikilinks, community ecosystem model         | Plugin dependency for basics, Electron weight, sync as paid lock-in |
| **Tolaria**  | Tauri stack, git-as-storage, AI-first vault design, keyboard-first UX  | Typed knowledge graph (Cork stays closer to freeform notes)         |
| **Inkdrop**  | Solo-dev sustainability proof, polished UX, "just works" sync          | Electron, CouchDB coupling, proprietary sync as the only option     |
| **Linear**   | 3-column triage layout, command palette as primary nav, visual density | SaaS-only model, team-oriented features                             |

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

**Triage layout (3-column, Linear-inspired).** See `src/features/shell/ui/triage/`.

Surfaces:

- **Sidebar** (left, ~260px) — Folder navigation, brand, "New note" CTA, settings gear.
- **NotesList** (middle, ~340px) — Note cards with title, time, excerpt, tag pills. Auto-selects first note.
- **EditorPane** (right, flexible) — CodeMirror 6 editor + optional collapsible Inspector panel.
- **Inspector** (right side panel) — Five sections: Outline / Tags / Properties / Backlinks / AI.
- **Command palette** (⌘K) — modal overlay, primary navigation device.
- **StatusBar** (bottom) — Vault path, note count.

Theme: Light / Dark / System (F15, shipped).

## Scope — What's actually shipped

**Implemented (verified against codebase 2026-06-25):**

- Local vault (open folder, persist recent vaults)
- File watcher for external changes
- SQLite index of notes/tags/wikilinks (FTS5)
- Triage 3-column layout (Sidebar + NotesList + EditorPane)
- CodeMirror 6 editor with markdown mode + split-pane preview
- Wikilinks `[[note]]` with autocomplete + click-to-navigate + create-on-click
- Inspector panel (Outline / Tags / Properties / Backlinks / AI)
- Command palette (⌘K)
- Folder operations (CRUD, drag-drop, bulk selection)
- Settings panel (6 sections) + per-vault config
- In-note search (⌘F / ⌘⇧F)
- Native OS menubar
- Light / Dark / System theming (F15)
- AI infrastructure + generate-note modal (F21, F23)
- Local git auto-commit (F18 — backend, no history UI)
- GitHub sync with PAT + SSH (F26)
- Onboarding scaffold (Welcome.md + starter content)
- Crash logging (local, F35)
- App icons + branding (F34)
- Desktop only (macOS, Windows, Linux via Tauri)

**Not yet implemented (specs exist, planned or deferred):**

- Home dashboard (F06 — removed, may revisit)
- Daily notes + multi-vault switcher (F10 — removed, may revisit)
- Live preview editor / WYSIWYG-feel (F16 — removed, may revisit)
- Calendar / agenda view (F19 — removed, may revisit)
- AI insights sidebar (F22 — removed, may revisit)
- AI slash commands (F24 — removed, may revisit)
- NoteHistory UI panel (F18 — backend ready)
- Asset drop/paste UI in editor (F11 — backend ready)
- CM6 rendering for callouts/footnotes/highlights (F14 — parser only)
- Code signing + notarization (F33 — needs certs)
- Remote crash reporting (F36 — planned)
- CRDT real-time sync (F37 — planned for v2)
- Relay auth & identity (F38 — planned for v2, GitHub OAuth + JWT)
- Graph view, semantic search, mobile, importers, plugins

## Constraints

- **Format:** vault stays pure `.md`. SQLite index lives in app data dir, not in vault.
- **Performance:** desktop bundle size and cold-start time matter (Tauri chosen over Electron). Avoid heavy runtime deps in the WebView.
- **Resources:** solo / small-team. Prioritize features with the highest UX leverage; defer anything requiring backend infra.
- **Multi-agent ready:** every feature lives in `.specs/features/Fxx-*/` with `spec.md`, `design.md`, `tasks.md`. Each task is atomic, traceable to a requirement ID, and committable independently. See [`AGENTS.md`](../../AGENTS.md).

## Long-term Direction

1. **v1 (current):** Desktop MVP — vault, editor, wikilinks, AI skills, git sync, theming. Ship it.
2. **v2:** CRDT-based real-time multi-device sync (Yjs + optional relay). Git stays as the archive/backup layer. See F37.
3. **v3:** Graph view, semantic search, deeper AI (embeddings/RAG grounded in your vault).
4. **Future:** Mobile companion, plugin API, self-hostable relay, community skills marketplace.

Revenue is not a v1 goal. The app is a personal project built with professional standards. If it grows, the model is open-core: free local app + optional hosted sync relay.

## Strategic Decisions

High-level product and business decisions. For architectural/implementation decisions, see `STATE.md` (AD-NNN series).

### SD-001: Local-first, not cloud-first (2026-05-06)

**Decision:** Cork is a local-first app. The vault is a folder on disk. All features work offline. Sync is opt-in.
**Alternatives considered:** Cloud-first with local cache (Notion model) — rejected: violates data ownership. Local with mandatory sync (iCloud/Dropbox) — rejected: unpredictable conflicts.
**Consequence:** No account required. No server costs for v1. Sync complexity isolated to F18/F26/F37.

### SD-002: Tauri over Electron (2026-05-06)

**Decision:** Tauri 2 (Rust + system WebView) instead of Electron.
**Why:** ~15 MB vs ~150 MB bundle, lower memory, Rust backend for indexing/git. Aligned with Tolaria.
**Trade-off:** WebKit2GTK quirks on Linux. No Node.js runtime — all native work via Rust IPC.

### SD-003: Git as primary sync transport (2026-05-07)

**Decision:** Git is the first-class sync mechanism. Every vault can be a git repo.
**Why:** Developers already understand git. Version history comes free. No proprietary sync server needed.
**Trade-off:** Not designed for real-time collaboration — requires CRDT layer for simultaneous editing (SD-005).

### SD-004: AI via local CLI subprocesses (2026-05-07)

**Decision:** AI features shell out to `claude` / `copilot` CLIs. No HTTP API providers, no API keys, no token billing.
**Why:** User already pays for and authenticates these tools. Cork adds contextual integration without duplicating auth/billing.
**Trade-off:** Depends on user having AI CLIs installed. No streaming/cancel (L-017).

### SD-005: CRDT + Git hybrid for multi-device sync (2026-06-25)

**Decision:** Real-time multi-device sync uses Yjs CRDTs as the collaboration layer, with git as the archive/backup underneath.
**Why:** Git cannot merge simultaneous edits without conflicts. CRDTs resolve this by design. Yjs has a mature CM6 binding (`y-codemirror.next`).
**Architecture:** Y.Doc per note → providers (disk, WebSocket relay, WebRTC P2P) → periodic flush to `.md` → git commit. See F37.
**Trade-off:** CRDT binary state adds ~2-5x storage. Rebuilding from `.md` loses operation history but preserves content.

### SD-006: Open-core model if the project grows (2026-06-25)

**Decision:** Free local app (open source) + optional hosted sync relay (paid or self-hostable).
**Why:** Threads the needle between Tolaria (fully free) and Inkdrop (fully paid). The relay is the value-add.
**Not decided yet:** License, pricing, whether to offer a hosted relay at all. Deferred until post-v1 traction.

### SD-007: No plugin API in v1 (2026-05-06)

**Decision:** Focused, opinionated feature set. No plugin/extension API.
**Why:** A plugin ecosystem is a product in itself. Solo-dev bandwidth better spent on core UX.
**Revisit when:** Community demand is clear and core features are stable (post-v2).
