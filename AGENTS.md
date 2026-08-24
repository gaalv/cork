# Cork Agent Guide

## Sources Of Truth

- Cork is a local-first desktop Markdown notes app: React 19/Vite 7 in `src/`, Tauri 2/Rust in `src-tauri/`, and a rebuildable SQLite index outside the vault.
- Trust executable config and current code before prose. `README.md` still lists the removed Vitest/Playwright setup and the old `src/features` layout; some early `.specs/` decisions and paths are historical or superseded.
- For feature work, check `.specs/project/ROADMAP.md` for the real status first, then relevant non-superseded decisions in `.specs/project/STATE.md`, `.specs/codebase/CONVENTIONS.md`, and the feature's `spec.md`/`design.md`/`tasks.md`.
- Stay inside a task's `Where` list. Do not silently choose behavior absent from the spec or a current decision; surface the decision before implementing it.

## Toolchain And Commands

- Use Node 20+, Corepack, and exactly pnpm (`packageManager: pnpm@9.15.0`); do not create npm or Yarn lockfiles. Rust uses stable and requires the platform-specific Tauri prerequisites.
- This is one root package, not a pnpm workspace. `pnpm install --frozen-lockfile` matches CI; use `pnpm add` when an approved task actually adds a dependency.

```bash
pnpm dev                    # browser-only Vite server on strict port 1420
pnpm tauri:dev              # full desktop app; starts Vite through tauri.conf.json
pnpm lint                   # ESLint, zero warnings allowed
pnpm typecheck              # tsc -b --noEmit
pnpm format:check           # check Prettier without rewriting
pnpm build                  # TypeScript build, then production Vite bundle
pnpm check:bundle-size --budget=500  # requires a current dist/ from pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri:build            # expensive native release build
```

- Blocking CI parity is `pnpm lint && pnpm typecheck && pnpm build && pnpm check:bundle-size --budget=500`. The separate `pnpm bench:index` CI job is intentionally non-blocking.
- Focus frontend checks with `pnpm exec eslint path/to/file.ts --max-warnings=0` and `pnpm exec prettier --check path/to/file.ts`.
- There is currently no configured JS test runner, E2E suite, Rust test suite, or `pnpm test` script. Do not follow stale test commands from `README.md` or old feature specs unless the task restores that tooling.
- The pre-commit hook runs `pnpm exec lint-staged`, which may rewrite staged JS/TS/CSS/Markdown/JSON/YAML. Reinspect the diff after it runs.

## Runtime Wiring

- Frontend startup is `src/main.tsx` (error/theme/density/font/capture/sync runtimes) -> `src/app/App.tsx` -> `src/screens/Shell.tsx`. The active triage composition is `src/screens/TriageBody.tsx`.
- Domain UI lives in `src/components/`; CodeMirror extensions in `src/cm/`; cross-cutting Zustand state in `src/stores/`; multi-store imperative flows in `src/services/`; typed native access in `src/ipc/`.
- `pnpm dev` cannot exercise filesystem, SQLite, native menus, dialogs, tray, shortcuts, or other Tauri IPC. Use `pnpm tauri:dev` for native behavior; web-safe fallbacks must be deliberate, not accidental production behavior.
- Backend startup and command registration live in `src-tauri/src/lib.rs`. `vault/` owns disk operations, `index/` owns SQLite/FTS and watcher-fed indexing, and `vcs/` owns local history and GitHub sync.

## Change Constraints

- An IPC command change normally touches all of: `src/ipc/IpcContract.ts`, the mapping/wrapper in `src/ipc/client.ts`, its Rust `#[tauri::command]` handler, and `tauri::generate_handler!` in `src-tauri/src/lib.rs`. Keep TypeScript and Rust contract changes together.
- Rust commands return serializable `Result<T, IpcError>`; do not panic across the IPC boundary.
- Vault Markdown is the content source of truth. The SQLite index is disposable and uses `src-tauri/src/index/schema.sql` plus `migrate.rs`; do not make the database authoritative for note content.
- Follow the existing state/service boundary rather than introducing direct component orchestration: stores own shared state and optimistic reconciliation, while services coordinate flows spanning IPC and multiple stores.
- Tailwind v4 is configured through `@theme` and CSS variables in `src/index.css`; there is no `tailwind.config.js`. Reuse existing `--color-cork-*` tokens and `cn()` from `@/utils/cn`; do not add CSS Modules or CSS-in-JS.
- `@/*` maps to `src/*`. Use the alias across directories and relative imports within a directory. TypeScript is strict and ESLint rejects explicit `any` outside test-file patterns.
- Do not hand-edit generated Tauri files under `src-tauri/gen/` or build outputs under `dist/` and `src-tauri/target/`.
- Versions must stay aligned across `package.json`, `version.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`; use `pnpm set-version -- <semver>`. Tag pushes build draft releases on four targets; signing/updater environment wiring is disabled, and the updater crate is not registered in `src-tauri/src/lib.rs`.
- When explicitly asked to commit, use Conventional Commits and keep one spec task per commit. Never mix unrelated or concurrent worktree changes into the task.
