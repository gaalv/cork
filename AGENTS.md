# Agents Guide

Welcome, agent. This file is your launchpad. Read it top-to-bottom before doing anything else.

## What is Cork

A local-first Markdown notes app for developers — Tauri 2 + React 19 + SQLite. Pure `.md` vault on disk, dev-grade editor, wikilinks, backlinks, command-driven UI. The layout is a **Triage 3-column layout** (Sidebar + NotesList + EditorPane) inspired by Linear. Stack mirrors [Tolaria](https://github.com/refactoringhq/tolaria).

Full vision: `.specs/project/PROJECT.md`.

## Where to start

1. Read `.specs/project/PROJECT.md` — vision, goals, scope, strategic decisions.
2. Read `.specs/project/ROADMAP.md` — find which milestone is current. **Important:** check feature statuses carefully — some specs are PARTIAL (not fully implemented) and some were removed (never implemented).
3. Read `.specs/project/STATE.md` — most recent decisions, blockers, deferred ideas. Treat decisions (`AD-NNN`) as **locked**; if you need to change one, update STATE.md first and explain why.
4. Read `.specs/codebase/CONVENTIONS.md` — non-negotiable code rules.
5. Read the spec for the feature you've been assigned: `.specs/features/Fxx-*/{spec.md,design.md,tasks.md}`.

## Multi-agent contract

Every feature is broken into atomic, traceable tasks. Multiple agents can work in parallel as long as they obey the rules below.

### Ownership

- One agent per task at a time. Tasks are tracked in the session SQL `todos` table (`id` matches `Fxx-Tyy`).
- A task is "yours" when its row has `status = 'in_progress'` and your agent ID. Update the row before starting.
- If a task you need is owned by another agent, work on a different parallelizable (`[P]`) task.

### Boundaries (hard rules)

- **Do not modify a feature folder you don't own** unless your task explicitly says so. Cross-feature collaboration goes through `src/shared/*`.
- **Do not edit `IpcContract.ts` and the Rust IPC handler in different commits.** Same task = same commit.
- **Do not invent dependencies.** If a library isn't in `package.json` or `Cargo.toml`, your task must include adding it AND the spec must allow it. Otherwise stop and flag.
- **Do not change conventions** (`CONVENTIONS.md`, `STRUCTURE.md`). If you think a rule should change, write a STATE.md entry and stop.
- **Never commit secrets** or call external services. v1 is offline-first.

### Workflow per task

```
1. Read the task block in tasks.md (What / Where / Depends on / Reuses / Done when / Verify).
2. Mark the SQL todo `in_progress`.
3. Implement ONLY what's listed under "Where".
4. Run the "Verify" command(s). All "Done when" boxes must check.
5. Self-review against `.specs/codebase/CONVENTIONS.md`.
6. `git add` only listed files; commit with the message specified.
7. Mark the SQL todo `done`. Append a row to STATE.md "Quick Tasks Completed" if it qualifies.
8. Move to the next task. If a task fails verification, set status to `blocked` with a description and stop.
```

### Parallelism map

Tasks tagged `[P]` in `tasks.md` can run simultaneously with other `[P]` tasks at the same dependency level. Tasks without `[P]` block their phase.

### Decision provenance

If you need to make a decision the spec doesn't cover:

1. Check `.specs/project/STATE.md` for an existing AD that applies.
2. If none, propose one in your response and add `AD-NNN` to STATE.md before continuing.
3. Never silently choose. Decisions must be searchable later.

## Stack quick reference

- **pnpm** is the package manager (via corepack). Do not use `npm` or `yarn`.
- **Tauri 2** + **Rust stable** in `src-tauri/`.
- **React 19** + **Vite 7** in `src/`.
- **Tailwind v4** with `@theme` tokens. No `tailwind.config.js`.
- **CodeMirror 6** is the editor. Not BlockNote (AD-006).
- **SQLite via rusqlite** in `src-tauri`. WAL mode.
- **Zustand** for cross-feature state.
- **Phosphor icons** + **Lucide** as fallback.
- **Vitest + RTL** for unit/component, **Playwright** for E2E.

## Commands you'll need

```bash
pnpm install              # install
pnpm dev                  # vite dev server (web only)
pnpm tauri dev            # full Tauri dev
pnpm build                # vite build
pnpm tauri build          # tauri release build
pnpm typecheck            # tsc -b --noEmit
pnpm lint                 # eslint
pnpm test                 # vitest run
pnpm test:e2e             # playwright (preview)
cd src-tauri && cargo test
```

## Repo layout (cheat sheet)

```
.specs/                  # source of truth — read first
  project/               # PROJECT, ROADMAP, STATE
  codebase/              # STACK, ARCHITECTURE, CONVENTIONS, STRUCTURE, TESTING
  features/Fxx-*/        # spec.md + design.md + tasks.md
src/                     # frontend
  features/
    ai/                  # AI infrastructure + generate note modal (F21, F23)
    assets/              # Asset ingest service (F11 — backend only, no UI)
    editor/              # CodeMirror 6 editor + Inspector panel (F05, F08, F32)
    folder-ops/          # Folder CRUD, drag-drop, bulk ops (F12)
    home/                # Empty — not yet implemented
    index/               # SQLite index frontend hooks (F03)
    quick-capture/       # Inbox + tray capture service (F17)
    settings/            # Settings panel + theme runtime (F13, F15)
    shell/               # Triage layout, command palette, view router (F04, F31)
    sync/                # GitHub sync service (F26)
    todos/               # Todos service registration (F25 — backend only, no UI)
    vault/               # Vault store, lifecycle, hooks (F02)
  shared/                # Cross-feature: stores, IPC, UI primitives, types
src-tauri/               # Rust backend
  src/
    ai/                  # Skills, cache, runner, telemetry
    assets/              # Asset protocol + DB
    diagnostics.rs       # Crash logging + redactor
    error.rs             # IpcError type
    index/               # SQLite schema, worker, parser, FTS5
    menu.rs              # Native OS menu
    settings.rs          # App + vault settings bridge
    todos/               # Todo CRUD on .cork/todos.json
    vault/               # FS ops, watcher, scaffold, folders, bulk
    vcs/                 # Git local + remote sync
brand/                   # Logo SVGs, icon source
tests/e2e/               # Playwright specs
AGENTS.md                # this file
CLAUDE.md                # Claude Code guidance
```

## Knowledge verification chain

Before introducing any technical claim:

1. Check existing code (`grep`/`view`).
2. Check `.specs/` docs.
3. Use `context7` MCP for library APIs (resolve ID, then query docs).
4. Web search for current docs.
5. If still unsure → say "I don't know" or flag as `uncertain`. **Never fabricate.**

## When you finish a feature

1. All tasks in its `tasks.md` are `done`.
2. The feature's spec.md requirements are verified.
3. The feature folder has a passing E2E spec under `tests/e2e/`.
4. Update `ROADMAP.md` status from `IN PROGRESS` → `COMPLETE`.
5. Add a one-line `L-NNN` Lesson Learned to STATE.md if anything surprising happened.

## When you're stuck

- Re-read the spec. The answer is usually there.
- Check `STATE.md` for AD-NNN that constrain the choice.
- If genuinely blocked, mark the task `blocked` with reason in the SQL todo, write a `B-NNN` blocker in STATE.md, and stop. Don't guess.

That's it. Be surgical, be honest, ship clean commits.
