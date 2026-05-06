# Project Structure

**Root:** `/Users/guilherme.aalves/www/personal/noxe/`

## Directory Tree

```
noxe/
├── .specs/                      # Spec-driven artifacts
│   ├── project/                 # PROJECT.md, ROADMAP.md, STATE.md
│   ├── codebase/                # STACK / ARCHITECTURE / CONVENTIONS / STRUCTURE / TESTING
│   └── features/                # One folder per Fxx with spec.md + design.md + tasks.md
├── prototype/                   # Layout playground (kept for reference, not shipped)
├── src/                         # Frontend (React 19, TS, Tailwind v4)
│   ├── app/                     # App shell, root providers, router
│   ├── features/                # Feature folders (1:1 with Fxx)
│   │   ├── shell/               # F04
│   │   ├── home/                # F06
│   │   ├── drawers/             # F07
│   │   ├── editor/              # F05
│   │   ├── note-view/           # F08
│   │   ├── wikilinks/           # F09
│   │   └── daily-notes/         # F10
│   ├── shared/                  # Cross-feature kernel
│   │   ├── ui/                  # Button, Card, Drawer, Kbd, IconButton, cn.ts, …
│   │   ├── stores/              # Zustand stores
│   │   ├── ipc/                 # IpcContract.ts + per-namespace wrappers
│   │   ├── md/                  # Markdown helpers (preview pipeline, wikilink plugin)
│   │   ├── types/               # Note, Vault, Tag, IPC types
│   │   └── utils/
│   ├── index.css                # Tailwind v4 entry + @theme tokens
│   ├── main.tsx                 # React root
│   └── App.tsx                  # Routes home ↔ note(id)
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── ipc/                 # Tauri command handlers (namespaced modules)
│   │   ├── vault/               # FS operations (read, write, list, resolve)
│   │   ├── index/               # SQLite + indexer
│   │   ├── watcher/             # notify integration
│   │   ├── error.rs             # IpcError + From impls
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── tests/                   # Rust integration tests
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── tests/
│   └── e2e/                     # Playwright smoke + regression specs
├── public/                      # Static assets served by Vite (icons, etc.)
├── .github/
│   └── workflows/               # CI (lint, typecheck, vitest, playwright, tauri build)
├── AGENTS.md                    # Multi-agent entry point
├── README.md
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
└── playwright.config.ts
```

## Module Organization

### `src/app/`

**Purpose:** Boot the React tree, wire providers, route between Home and Note views.
**Key files:** `App.tsx`, `Providers.tsx`, `routes.ts`.

### `src/features/<name>/`

**Purpose:** One feature = one folder. Owns its UI, hooks, and feature-local services.
**Standard layout:**
```
features/<name>/
├── ui/                # React components (PascalCase.tsx)
├── hooks/             # useXxx.ts
├── services/          # Optional — wraps shared/ipc with feature-specific logic
├── index.ts           # Public exports (only what other parts of the app need)
└── README.md          # 1-paragraph summary + link to spec
```

### `src/shared/`

**Purpose:** Anything used by 2+ features.
- `ui/` — generic React primitives. No business logic.
- `stores/` — Zustand stores. One file per store.
- `ipc/` — `IpcContract.ts` + per-namespace wrapper (`vault.ts`, `notes.ts`, `index.ts`, `links.ts`).
- `md/` — Markdown helpers shared between editor and preview (e.g., wikilink regex, tag regex).
- `types/` — TS types referenced across features.
- `utils/` — pure helpers, no side effects.

### `src-tauri/src/`

**Purpose:** Rust backend. Each subfolder is a module.
- `ipc/` — `mod.rs` registers commands; one file per command namespace (`vault.rs`, `notes.rs`, `index.rs`, `links.rs`).
- `vault/` — file system operations. No DB code here.
- `index/` — SQLite schema, migrations, queries, indexer.
- `watcher/` — `notify` setup and event debouncer.
- `error.rs` — `IpcError` enum.

### `prototype/`

**Purpose:** Layout playground from the planning phase. Kept for reference but excluded from CI builds. Will be deleted at v1 release.

## Where Things Live

**Note rendering:**
- Editor: `src/features/editor/ui/Editor.tsx` (CodeMirror 6 setup)
- Preview: `src/features/editor/ui/Preview.tsx` (react-markdown pipeline)
- Wikilink decoration plugin (CM6): `src/features/wikilinks/services/cmPlugin.ts`
- Shared markdown helpers: `src/shared/md/`

**Open a vault:**
- Frontend: `src/features/shell/ui/VaultPicker.tsx` (or invoked from Settings)
- IPC wrapper: `src/shared/ipc/vault.ts`
- Rust handler: `src-tauri/src/ipc/vault.rs`
- FS ops: `src-tauri/src/vault/`

**Search:**
- Frontend: `src/features/drawers/ui/SearchDrawer.tsx`
- IPC: `src/shared/ipc/index.ts` (`index.search`)
- Rust: `src-tauri/src/ipc/index.rs` → `src-tauri/src/index/search.rs`

**Backlinks:**
- Frontend: `src/features/note-view/ui/BacklinksPanel.tsx`
- IPC: `src/shared/ipc/links.ts` (`links.backlinksOf`)
- Rust: `src-tauri/src/ipc/links.rs` → query against `links` table.

## Special Directories

- `.specs/` — read-only at build time; never imported by `src/`. Treat as documentation.
- `tests/e2e/` — runs against `pnpm tauri dev` or `vite preview` (Playwright config selects).
- `prototype/` — has its own `package.json` and `pnpm install`; isolated from the app.
