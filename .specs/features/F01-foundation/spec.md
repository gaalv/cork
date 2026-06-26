# F01 — Foundation Specification

**Owner phase:** M0
**Depends on:** none
**Status:** Draft

## Problem Statement

There's no app yet — only a layout prototype in `/prototype`. We need a real Tauri 2 + React 19 + TS + Tailwind v4 scaffold that builds, runs, lints, types, and tests cleanly, with CI in place. Without this, no other feature can be implemented safely.

## Goals

- [ ] `pnpm install && pnpm tauri dev` opens a Tauri window rendering the Layout C shell on macOS, Windows, and Linux.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e -- tests/e2e/smoke/launch.spec.ts && (cd src-tauri && cargo test)` all pass.
- [ ] CI on every push runs lint, typecheck, vitest, smoke E2E, cargo test; tagged releases also build Tauri per OS.
- [ ] Prototype's Layout C UI is migrated to `src/features/shell/` and renders mock data (ok for now — real data lands in F02+).

## Out of Scope

| Feature                | Reason                                          |
| ---------------------- | ----------------------------------------------- |
| Real vault FS          | F02                                             |
| SQLite index           | F03                                             |
| Editor                 | F05                                             |
| Wikilink resolution    | F09                                             |
| App icons / branding   | M6 release prep                                 |
| Auto-update / signing  | M6 release prep                                 |
| Dark mode              | Out of v1 (PROJECT.md)                          |

---

## User Stories

### P1: Boot the app ⭐ MVP

**User Story:** As a developer, I want to clone the repo and run `pnpm tauri dev` to see Cork's Layout C shell, so I can iterate on features.

**Why P1:** Without a runnable shell, nothing else can be built or verified.

**Acceptance Criteria:**
1. WHEN a fresh clone runs `pnpm install && pnpm tauri dev` THEN the system SHALL open a native window titled "Cork" rendering the Home view of Layout C.
2. WHEN the user clicks the rail icons THEN the system SHALL toggle the corresponding drawers (using mock data; no real persistence).
3. WHEN the user presses ⌘K (or Ctrl+K on Linux/Windows) THEN the system SHALL open the command palette modal with a focused input.
4. WHEN there is no `pnpm-lock.yaml` THEN the system SHALL fail the install with a clear message and CI SHALL fail.

**Independent Test:** `pnpm tauri dev` boots a window with rail + topbar + Home + drawer + palette working against mock data.

---

### P1: Quality gates green ⭐ MVP

**User Story:** As an agent, I want lint, typecheck, unit, smoke, and rust tests to all pass on a fresh clone, so I know my baseline is healthy before changing anything.

**Why P1:** Multi-agent work demands a deterministic baseline.

**Acceptance Criteria:**
1. WHEN `pnpm typecheck` runs THEN the system SHALL exit 0 with no errors.
2. WHEN `pnpm lint` runs THEN the system SHALL exit 0 with no errors.
3. WHEN `pnpm test` runs THEN at least 5 unit/component tests SHALL execute and pass.
4. WHEN `pnpm test:e2e -- tests/e2e/smoke/launch.spec.ts` runs against `pnpm preview` THEN the launch smoke spec SHALL pass.
5. WHEN `cd src-tauri && cargo test` runs THEN at least 1 Rust test SHALL execute and pass.

**Independent Test:** All five commands exit 0 in a fresh clone.

---

### P1: CI runs on every push ⭐ MVP

**User Story:** As a maintainer, I want GitHub Actions to enforce quality on every push and PR, so regressions are caught.

**Why P1:** Multi-agent work without CI guardrails leads to breakage.

**Acceptance Criteria:**
1. WHEN a commit is pushed to any branch THEN GitHub Actions SHALL run a `quality` workflow (lint, typecheck, vitest).
2. WHEN a PR is opened THEN the workflow above PLUS `e2e-smoke` and `rust` jobs SHALL run.
3. WHEN a tag matching `v*` is pushed THEN a `release` workflow SHALL build Tauri on macOS, Windows, and Linux.
4. WHEN any required job fails THEN the PR SHALL be blocked.

**Independent Test:** Open a draft PR with a deliberate ESLint error → CI fails the lint job.

---

### P2: Migrate prototype Layout C into the app

**User Story:** As a developer, I want the Home, rail, drawers, and palette UIs from `/prototype` to live inside `src/` under proper feature folders, so we don't rebuild them.

**Why P2:** Prototype already encodes the agreed visual direction; copying saves time.

**Acceptance Criteria:**
1. WHEN F01 completes THEN `src/features/shell/`, `src/features/home/`, `src/features/drawers/`, and `src/features/note-view/` SHALL each have an `index.ts` and a stub UI matching the prototype (mock data for now).
2. WHEN the migrated UI renders THEN it SHALL be visually identical to `/prototype` Layout C (token-for-token Tailwind v4 classes).
3. WHEN the user opens the app THEN the Home view SHALL be the default route.

**Independent Test:** Compare a screenshot of `pnpm tauri dev` Home with a screenshot of `/prototype` Layout C — they match within 2 px diff.

---

### P3: Pre-commit hooks

**User Story:** As a contributor, I want husky + lint-staged equivalent to run lint + format on staged files, so I don't push broken code.

**Why P3:** Nice-to-have. CI catches it anyway.

**Acceptance Criteria:**
1. WHEN a commit is created THEN the system SHALL run `pnpm lint --fix` and `pnpm prettier --write` against staged files only.
2. WHEN any of those exits non-zero THEN the commit SHALL be aborted.

---

## Edge Cases

- WHEN the user is on Linux without WebKitGTK 4.1 THEN `pnpm tauri dev` SHALL show a clear error message in stdout pointing to the Tauri prerequisites doc.
- WHEN `corepack` is not enabled THEN `pnpm install` SHALL fail with guidance to run `corepack enable`.
- WHEN the WebView fails to load due to a Vite port conflict THEN `pnpm tauri dev` SHALL surface the Vite error log instead of a blank window.

---

## Requirement Traceability

| Requirement ID | Story                          | Phase  | Status  |
| -------------- | ------------------------------ | ------ | ------- |
| FOUND-01       | P1: Boot the app               | Tasks  | Pending |
| FOUND-02       | P1: Boot the app               | Tasks  | Pending |
| FOUND-03       | P1: Boot the app               | Tasks  | Pending |
| FOUND-04       | P1: Boot the app               | Tasks  | Pending |
| FOUND-05       | P1: Quality gates green        | Tasks  | Pending |
| FOUND-06       | P1: Quality gates green        | Tasks  | Pending |
| FOUND-07       | P1: Quality gates green        | Tasks  | Pending |
| FOUND-08       | P1: Quality gates green        | Tasks  | Pending |
| FOUND-09       | P1: Quality gates green        | Tasks  | Pending |
| FOUND-10       | P1: CI                         | Tasks  | Pending |
| FOUND-11       | P1: CI                         | Tasks  | Pending |
| FOUND-12       | P1: CI                         | Tasks  | Pending |
| FOUND-13       | P1: CI                         | Tasks  | Pending |
| FOUND-14       | P2: Migrate Layout C           | Tasks  | Pending |
| FOUND-15       | P2: Migrate Layout C           | Tasks  | Pending |
| FOUND-16       | P3: Pre-commit hooks           | Tasks  | Pending |

**Coverage:** 16 total, mapped to 16 tasks. None unmapped.

---

## Success Criteria

- [ ] `pnpm tauri dev` opens Layout C in < 5 s on a recent dev machine.
- [ ] All five quality commands exit 0 in CI.
- [ ] Bundle: production build < 500 kB gzipped JS (budget set in F01-T13).
- [ ] No TypeScript `any` in committed code (ESLint rule enforced).
