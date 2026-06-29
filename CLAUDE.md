# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Cork

A local-first Markdown notes app for developers — Tauri 2 (Rust backend) + React 19 (TypeScript frontend) + SQLite. Pure `.md` vault on disk, CodeMirror 6 editor, wikilinks/backlinks, command-driven UI. The layout is a **Triage 3-column layout** (Sidebar + NotesList + EditorPane) inspired by Linear. v1 is offline-first: no external API calls, no secrets.

## Commands

```bash
pnpm install              # install deps (pnpm only — no npm/yarn)
pnpm dev                  # vite dev server on :1420 (web only, no Tauri)
pnpm tauri:dev            # full Tauri desktop app in dev mode
pnpm build                # typecheck + production vite bundle
pnpm tauri:build          # native release binaries
pnpm typecheck            # tsc -b --noEmit
pnpm lint                 # eslint (max-warnings=0)
pnpm format               # prettier write
pnpm format:check         # prettier check (CI)
```

## Architecture

### Frontend (`src/`)

**Feature-folder architecture.** Each capability in `src/features/` owns its own `ui/`, `hooks/`, `services/`, `state/`, and `index.ts`.

Actual feature folders: `ai/`, `assets/`, `editor/`, `folder-ops/`, `home/` (empty — not yet built), `index/`, `quick-capture/`, `settings/`, `shell/` (triage layout + command palette), `sync/`, `todos/` (backend only — no UI), `vault/`.

**Hard rule:** Feature folders must NOT import from other feature folders. Cross-feature communication goes through `src/shared/` (stores, types, IPC, UI primitives).

**State management:** Zustand for cross-feature state (`vaultStore`, `editorStore`, `indexStore`, `appSettingsStore`). Local UI state uses `useState`/`useReducer`. No React Query — IPC calls cached in feature-local hooks.

**IPC layer:** `src/shared/ipc/IpcContract.ts` is the single source of truth for all Tauri commands/events. `src/shared/ipc/client.ts` wraps `tauri.invoke` with full type safety. IpcContract.ts and Rust handlers must always be edited in the same commit.

**Styling:** Tailwind v4 with `@theme` tokens in `src/index.css`. Use `cn()` from `@/shared/ui/cn.ts` (clsx + tailwind-merge). No CSS Modules/styled-components. No hardcoded hex — use tokens.

**Path alias:** `@/*` maps to `src/*` (use for cross-boundary imports; same-folder stays relative).

### Shell layout

The app uses a **Triage layout** (3-column): `Sidebar` (folders/navigation, 260px) + `NotesList` (note cards, 340px) + `EditorPane` (editor + optional Inspector). Components live in `src/features/shell/ui/triage/`. There is no Rail, no TopBar, no Home Dashboard, no Drawers — those were an earlier layout concept that was never implemented.

### Backend (`src-tauri/`)

Rust modules: `vault/` (filesystem ops, scaffold, watcher, folders, bulk ops), `index/` (SQLite indexer with FTS5, WAL mode), `ai/` (skills, cache, runner), `assets/`, `todos/`, `vcs/` (git local + remote sync), `settings.rs`, `menu.rs`, `diagnostics.rs` (crash logging), `error.rs`. Each module defines `#[tauri::command]` handlers.

**Indexer flow:** Vault open → scan `.md` files → parse with `pulldown-cmark` → upsert SQLite. File watcher (`notify`, 200ms debounce) keeps index in sync. Emits `index:updated` events to frontend.

**Error handling:** All IPC commands return `Result<T, IpcError>`. Never panic across IPC boundary.

### Spec-driven development

`.specs/` is the source of truth for all features. Before working on a feature, read:

1. `.specs/project/PROJECT.md` — vision, beliefs, strategic decisions
2. `.specs/project/ROADMAP.md` — current milestone + what's real vs planned
3. `.specs/project/STATE.md` — architectural decisions (`AD-NNN` are locked), blockers, lessons
4. `.specs/codebase/CONVENTIONS.md` — non-negotiable code rules
5. `.specs/features/Fxx-*/{spec.md,design.md,tasks.md}` — feature requirements and tasks

**Important:** Some specs describe features that are PARTIAL or not yet implemented. Always check the ROADMAP status before assuming a feature exists in code.

## Key conventions

- **Naming:** Components `PascalCase.tsx`, hooks `useCamelCase.ts`, stores `camelCaseStore.ts`, Rust `snake_case.rs`. Tauri commands: dot-separated (`vault.open`, `notes.save`).
- **Types:** `strict: true` in tsconfig. Never `any` — use `unknown` and narrow. Prefer `type` over `interface`.
- **Components:** < 200 lines. Hooks ordered: state → context → effects → handlers.
- **Imports:** Node builtins → external packages → `@/` aliases → relative → type-only imports last.
- **Mutations:** All data writes (tags, pins, notes) go through Zustand store methods — never direct IPC in components. Pattern: optimistic update → persist async → rollback on error. See `CONVENTIONS.md § Optimistic mutations`.
- **Git:** Conventional Commits 1.0. One task = one commit.
- **Icons:** Phosphor icons primary, Lucide as fallback.

## Performance budgets

- Cold start (release): < 1.5s on M1/M2
- 1k-note vault index: < 3s; subsequent < 200ms
- Editor keystroke latency: < 16ms
- JS bundle: < 500 kB gzipped
