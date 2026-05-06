# Noxe

Local-first Markdown notes desktop app. Built with Tauri 2 + React 19 + Vite 7 + TypeScript 5 + Tailwind v4 + CodeMirror 6 + SQLite. Layout C ("Minimal + Command") — keyboard-first, palette-driven, single-vault per window with multi-vault switcher.

> Status: v1 in active development. The complete plan (171 atomic tasks, 14 features) lives under `.specs/`. See [`AGENTS.md`](./AGENTS.md) for the multi-agent contribution contract.

## Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **pnpm** via [corepack](https://nodejs.org/api/corepack.html): `corepack enable`
- **Rust** stable: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **OS-specific Tauri deps:** see https://tauri.app/start/prerequisites/

  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev`
  - Windows: Microsoft C++ Build Tools + WebView2 (preinstalled on Windows 11)

## Quickstart

```bash
pnpm install
pnpm tauri:dev      # boots Tauri desktop app
pnpm dev            # boots Vite-only frontend on :1420 (no native window)
```

## Scripts

| Script              | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Vite dev server (`http://localhost:1420`)                        |
| `pnpm build`        | TS check + production frontend bundle                            |
| `pnpm preview`      | Serve `dist/` on `:4173` (used by Playwright)                    |
| `pnpm tauri:dev`    | Run the Tauri desktop app in dev                                 |
| `pnpm tauri:build`  | Build native binaries                                            |
| `pnpm typecheck`    | `tsc -b --noEmit`                                                |
| `pnpm lint`         | ESLint flat config                                               |
| `pnpm format`       | Prettier write                                                   |
| `pnpm test`         | Vitest unit + component tests                                    |
| `pnpm test:watch`   | Vitest watch mode                                                |
| `pnpm test:coverage`| Vitest coverage report                                           |
| `pnpm test:e2e`     | Playwright E2E (boots `pnpm preview` automatically)              |

## Repository layout

```
.
├── src/                    # React app (frontend)
│   ├── app/                # Bootstrap, providers, root component
│   ├── features/           # One folder per Fxx feature
│   │   ├── _legacy/        # Migrated prototype Layout C (to be split by F04+)
│   │   ├── _mock/          # Mock data used until F02/F03 land
│   │   ├── editor/         # F05 — CodeMirror 6
│   │   ├── shell/          # F04
│   │   ├── home/           # F06
│   │   ├── drawers/        # F07
│   │   └── note-view/      # F08
│   ├── shared/             # Cross-feature primitives
│   │   ├── ipc/            # Tauri IPC client wrappers
│   │   ├── stores/         # Zustand stores
│   │   ├── ui/             # Reusable UI primitives
│   │   └── utils/          # Pure utils (cn, etc.)
│   └── test/               # Vitest setup
├── src-tauri/              # Rust backend (Tauri)
│   └── src/
│       └── error.rs        # IpcError canonical type
├── tests/e2e/              # Playwright specs
├── prototype/              # Layout exploration playground (read-only reference)
├── .specs/                 # Spec-driven plan (PROJECT, ROADMAP, STATE, features)
└── AGENTS.md               # Multi-agent contribution contract
```

## Where to start as a contributor / agent

1. Read [`AGENTS.md`](./AGENTS.md) — task ownership, commit rules, parity gates.
2. Read [`.specs/project/STATE.md`](./.specs/project/STATE.md) — architectural decisions.
3. Pick a feature directory under [`.specs/features/`](./.specs/features) and follow `spec.md` → `design.md` → `tasks.md`.
4. One task = one commit (Conventional Commits + `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer).
