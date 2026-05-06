# F01 — Foundation Tasks

**Design:** `.specs/features/F01-foundation/design.md`
**Status:** Draft

## Execution Plan

### Phase 1: Scaffold (sequential)

```
T01 → T02 → T03 → T04
```

### Phase 2: Tooling (parallel after T04)

```
       ┌→ T05 [P] ┐
       ├→ T06 [P] ┤
T04 ───┼→ T07 [P] ┼──→ T11
       ├→ T08 [P] ┤
       └→ T09 [P] ┘
```

### Phase 3: Migrate prototype (parallel after T05–T09)

```
T11 ──┬→ T14 [P]
      └→ T15 [P]
```

### Phase 4: CI + hooks (sequential after migration)

```
T14, T15 → T10 → T12 → T13 → T16
```

---

## Tasks

### T01: Initialize Tauri 2 project skeleton

**What:** Run `pnpm create tauri-app` (non-interactive flags) producing a Tauri 2 + Vite + React + TS skeleton at the repo root, alongside the existing `prototype/`.
**Where:** Creates `src/`, `src-tauri/`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `tauri.conf.json`.
**Depends on:** None
**Reuses:** Tauri's `react-ts` template
**Requirement:** FOUND-01

**Tools:** bash
**Done when:**
- [ ] `package.json` lists `@tauri-apps/api ^2.10`, `@tauri-apps/cli ^2.10`, `react ^19`, `vite ^7`
- [ ] `src-tauri/Cargo.toml` declares `tauri = { version = "2", ... }`
- [ ] `pnpm install` exits 0
- [ ] `prototype/` is untouched

**Verify:**
```bash
pnpm install && cat package.json | jq '.dependencies | keys' | grep '@tauri-apps/api'
```

**Commit:** `feat(foundation): initialize tauri 2 + react 19 + vite 7 skeleton`

---

### T02: Add Tailwind v4 via Vite plugin

**What:** Install `tailwindcss@^4`, `@tailwindcss/vite@^4`. Wire the plugin in `vite.config.ts`. Create `src/index.css` with `@import "tailwindcss"` and the `@theme` block from `prototype/src/index.css`.
**Where:** `package.json`, `vite.config.ts`, `src/index.css`, `src/main.tsx`
**Depends on:** T01
**Reuses:** `prototype/src/index.css` (copy `@theme` and base styles)
**Requirement:** FOUND-01, FOUND-15

**Tools:** bash, edit
**Done when:**
- [ ] `vite.config.ts` calls `tailwindcss()` after `react()`
- [ ] `src/index.css` is imported in `src/main.tsx`
- [ ] `pnpm dev` renders a page using a `bg-noxe-bg` class without errors

**Verify:** `pnpm dev` and inspect a styled element in DevTools.

**Commit:** `feat(foundation): wire tailwind v4 with @theme tokens`

---

### T03: Strict TS config + path alias

**What:** Update `tsconfig.json` with `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `paths: { "@/*": ["src/*"] }`. Add same alias to `vite.config.ts` via `resolve.alias`.
**Where:** `tsconfig.json`, `vite.config.ts`
**Depends on:** T01
**Requirement:** FOUND-05

**Tools:** edit
**Done when:**
- [ ] `pnpm typecheck` passes
- [ ] `import x from '@/shared/...'` resolves at build time

**Verify:** `pnpm typecheck`

**Commit:** `chore(foundation): enforce strict ts + @/ alias`

---

### T04: ESLint flat config + Prettier

**What:** Add `eslint.config.js` (flat) with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`. Disallow `any`. Add `.prettierrc` (defaults). Wire `pnpm lint` and `pnpm format`.
**Where:** `eslint.config.js`, `.prettierrc`, `package.json` scripts
**Depends on:** T03
**Requirement:** FOUND-06

**Tools:** edit
**Done when:**
- [ ] `pnpm lint` passes on the empty `src/`
- [ ] A `let x: any = 1` line in any `.ts` file fails lint

**Verify:** `pnpm lint`

**Commit:** `chore(foundation): add eslint flat config and prettier`

---

### T05: Vitest + RTL setup [P]

**What:** Install `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Add `vitest.config.ts` (jsdom env, setup file with jest-dom matchers). Add `pnpm test`, `pnpm test:watch`, `pnpm test:coverage` scripts. Write 1 placeholder unit test in `src/shared/utils/cn.test.ts` (will be filled in T07).
**Where:** `vitest.config.ts`, `src/test/setup.ts`, `package.json`, `src/shared/utils/cn.test.ts`
**Depends on:** T04
**Requirement:** FOUND-07

**Tools:** edit
**Done when:**
- [ ] `pnpm test` exits 0 with at least 1 passing test

**Verify:** `pnpm test`

**Commit:** `chore(foundation): set up vitest + rtl`

---

### T06: Playwright smoke harness [P]

**What:** Install `@playwright/test`, run `pnpm exec playwright install chromium`. Add `playwright.config.ts` (against `pnpm preview` :4173). Add `tests/e2e/smoke/launch.spec.ts` that visits `/`, asserts the page title is "Noxe" and at least one `[data-testid="rail"]` element exists. Add `pnpm test:e2e` script.
**Where:** `playwright.config.ts`, `tests/e2e/smoke/launch.spec.ts`, `package.json`
**Depends on:** T04
**Requirement:** FOUND-08

**Tools:** edit, bash
**Done when:**
- [ ] `pnpm build && pnpm test:e2e` exits 0

**Verify:** above command in CI environment.

**Commit:** `chore(foundation): add playwright smoke harness`

---

### T07: cn() helper + first unit test [P]

**What:** Create `src/shared/utils/cn.ts` exporting `cn(...inputs)` using `clsx` + `tailwind-merge`. Replace the placeholder test from T05 with real assertions.
**Where:** `src/shared/utils/cn.ts`, `src/shared/utils/cn.test.ts`
**Depends on:** T05
**Requirement:** FOUND-07

**Tools:** edit, bash
**Done when:**
- [ ] `cn('a', false && 'b', 'c')` → `'a c'`
- [ ] `cn('p-2', 'p-4')` → `'p-4'`
- [ ] Test passes

**Commit:** `feat(shared): add cn() helper`

---

### T08: Rust scaffold + 1 cargo test [P]

**What:** Add `src-tauri/src/error.rs` with a minimal `IpcError` enum (`Io`, `Parse`, `NotFound`, `Other(String)`). Wire it into `lib.rs`. Add a unit test in `error.rs` that asserts `IpcError::NotFound` serializes to JSON `{"kind":"NotFound"}` via serde.
**Where:** `src-tauri/src/error.rs`, `src-tauri/src/lib.rs`
**Depends on:** T01
**Requirement:** FOUND-09

**Tools:** edit
**Done when:**
- [ ] `cd src-tauri && cargo test` exits 0 with at least 1 passing test

**Verify:** `cd src-tauri && cargo test`

**Commit:** `feat(rust): add IpcError enum scaffold`

---

### T09: package.json scripts [P]

**What:** Ensure all of: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`, `test:watch`, `test:coverage`, `test:e2e`, `tauri`, `tauri:dev`, `tauri:build`, `prepare` are present and aligned with conventions.
**Where:** `package.json`
**Depends on:** T04, T05, T06
**Requirement:** FOUND-05, FOUND-06, FOUND-07, FOUND-08

**Tools:** edit
**Done when:**
- [ ] `pnpm run` lists all scripts
- [ ] Each runs without command-not-found

**Commit:** `chore(foundation): consolidate package scripts`

---

### T10: Husky + lint-staged equivalent

**What:** Install `husky`. Add `prepare` script. Configure `.husky/pre-commit` to run `pnpm exec lint-staged`. Install `lint-staged` and configure to run `eslint --fix` and `prettier --write` on staged `*.{ts,tsx,js,css,md}`.
**Where:** `.husky/pre-commit`, `package.json` (`lint-staged` block)
**Depends on:** T14, T15
**Requirement:** FOUND-16

**Tools:** edit, bash
**Done when:**
- [ ] `git commit` on a file with deliberate ESLint error fails the commit
- [ ] `pnpm prepare` installs hooks idempotently

**Commit:** `chore(foundation): add husky + lint-staged pre-commit`

---

### T11: Index.html + main.tsx + Providers [P-leader]

**What:** Author `index.html`, `src/main.tsx`, `src/app/Providers.tsx` (empty for now), `src/app/App.tsx` rendering "Noxe" placeholder. Replace Tauri template's default code.
**Where:** `index.html`, `src/main.tsx`, `src/app/{App,Providers}.tsx`
**Depends on:** T03
**Requirement:** FOUND-01

**Tools:** edit
**Done when:**
- [ ] `pnpm dev` shows the placeholder page
- [ ] `pnpm tauri dev` shows the same page in a window

**Commit:** `feat(app): bootstrap react root and providers`

---

### T14: Migrate prototype Layout C — shell + home + drawers [P]

**What:** Copy `prototype/src/layouts/LayoutMinimalCommand.tsx` and split it into:
- `src/features/shell/ui/Rail.tsx`, `TopBar.tsx`, `CommandPalette.tsx`
- `src/features/home/ui/{HomeView,HomeHero,PinnedGrid,RecentsList,TagPills,AllNotesGrid,NoteCard}.tsx`
- `src/features/drawers/ui/{DrawerContainer,SearchDrawer,FoldersDrawer,RecentDrawer,StarredDrawer,TagsDrawer}.tsx`
Each component preserves the Tailwind classes 1:1. Add `data-testid` attributes for the smoke test (`rail`, `topbar`, `home`, `palette`).
**Where:** `src/features/{shell,home,drawers}/ui/...`
**Depends on:** T11
**Reuses:** `prototype/src/layouts/LayoutMinimalCommand.tsx`
**Requirement:** FOUND-14, FOUND-15

**Tools:** view, create, edit
**Done when:**
- [ ] Each new file < 200 lines (split if needed)
- [ ] `pnpm typecheck` and `pnpm lint` pass
- [ ] `pnpm dev` renders Home with rail + topbar + drawer toggles + palette modal

**Commit:** `feat(shell|home|drawers): migrate layout C from prototype`

---

### T15: Migrate prototype Layout C — note view + editor stub + mock data [P]

**What:**
- Move `prototype/src/data/mock.ts` to `src/features/_mock/mockData.ts` (interim home for mock; will be replaced by IPC calls in F02–F03).
- Move `prototype/src/components/MockMarkdown.tsx` to `src/features/editor/ui/MockMarkdown.tsx`.
- Split `LayoutMinimalCommand.tsx`'s `NoteView` into `src/features/note-view/ui/{NoteView,NoteMetaPanel,Outline,BacklinksList,RecentsList,AISuggestionCard}.tsx`.
**Where:** `src/features/{_mock,note-view,editor}/...`
**Depends on:** T11
**Reuses:** prototype as above
**Requirement:** FOUND-14, FOUND-15

**Tools:** view, create
**Done when:**
- [ ] Clicking a card in Home opens the Note view
- [ ] Back-to-Home button works
- [ ] Outline + Backlinks render against mock data

**Commit:** `feat(note-view|editor): migrate layout C note view from prototype`

---

### T12: GitHub Actions — quality + e2e + rust

**What:** Add `.github/workflows/quality.yml` running on push and PR with jobs:
- `lint-typecheck` — `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`
- `unit` — `pnpm test --reporter=dot`
- `e2e-smoke` — `pnpm build && pnpm test:e2e -- tests/e2e/smoke/`
- `rust` — `cd src-tauri && cargo test`
All four required for PRs to main.
**Where:** `.github/workflows/quality.yml`
**Depends on:** T10
**Requirement:** FOUND-10, FOUND-11, FOUND-13

**Tools:** edit
**Done when:**
- [ ] Workflow file YAML-valid (`actionlint`)
- [ ] First push to a branch triggers the workflow

**Verify:** Push and observe Actions tab.

**Commit:** `ci(foundation): add quality workflow`

---

### T13: GitHub Actions — release matrix

**What:** Add `.github/workflows/release.yml` triggered on `tags: [v*]`. Matrix over `macos-latest`, `windows-latest`, `ubuntu-22.04`. Steps: `pnpm install`, `pnpm tauri build`, upload artifacts to the release. Include the Linux deps install step from Tolaria's README.
**Where:** `.github/workflows/release.yml`
**Depends on:** T12
**Requirement:** FOUND-12

**Tools:** edit
**Done when:**
- [ ] YAML valid
- [ ] Manual `gh workflow run release.yml` (dry-run) succeeds

**Commit:** `ci(foundation): add release matrix workflow`

---

### T16: README — quickstart + agent pointer

**What:** Update repo `README.md` with: project pitch (1 paragraph), prerequisites (Node 20+, pnpm via corepack, Rust stable, OS-specific Tauri deps), quickstart (`pnpm install && pnpm tauri dev`), pointer to `AGENTS.md` and `.specs/`.
**Where:** `README.md`
**Depends on:** T13
**Requirement:** none (housekeeping)

**Tools:** edit
**Done when:**
- [ ] README compiles (Markdown valid)
- [ ] Quickstart commands match `package.json` scripts

**Commit:** `docs(foundation): rewrite readme with quickstart and agent pointers`

---

## Parallel execution map

```
Phase 1: T01 → T02 → T03 → T04
Phase 2 (after T04): { T05[P], T06[P], T08[P], T09[P], T11[P-leader] }
Phase 2.5 (after T05): T07[P]
Phase 3 (after T11): { T14[P], T15[P] }
Phase 4 (after T14, T15): T10 → T12 → T13 → T16
```

## Granularity check

| Task | Scope         | Status      |
| ---- | ------------- | ----------- |
| T01  | scaffold cmd  | ✅ Granular |
| T02  | one config    | ✅ Granular |
| T03  | tsconfig      | ✅ Granular |
| T04  | eslint+prettier | ✅ Granular |
| T05  | vitest setup  | ✅ Granular |
| T06  | playwright setup | ✅ Granular |
| T07  | one util      | ✅ Granular |
| T08  | one rust file | ✅ Granular |
| T09  | scripts list  | ✅ Granular |
| T10  | husky setup   | ✅ Granular |
| T11  | app boot      | ✅ Granular |
| T12  | one workflow  | ✅ Granular |
| T13  | one workflow  | ✅ Granular |
| T14  | feature folders (large but cohesive) | ⚠️ Borderline; OK because cohesive copy |
| T15  | feature folders (large but cohesive) | ⚠️ Borderline; OK because cohesive copy |
| T16  | one doc       | ✅ Granular |
