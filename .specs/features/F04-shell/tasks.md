# F04 — Shell Tasks

```
T01 → T02 → { T03[P], T04[P], T05[P], T06[P] } → T07 → T08 → T09 → T10 → T11 → T12 → T13
```

### T01: Install libs
**What:** `pnpm add cmdk focus-trap-react sonner tinykeys fuzzysort`. Type defs included.
**Where:** `package.json`
**Depends on:** F01
**Requirement:** all
**Done when:** `pnpm typecheck` passes.
**Commit:** `chore(shell): add palette + a11y libs`

### T02: shellStore
**What:** Implement `shellStore` per design (state + actions). Persistence via `tauri-plugin-store`.
**Where:** `src/features/shell/state/shellStore.ts`
**Depends on:** T01
**Requirement:** SHELL-01..04, 05, 06, 09, 22, 23
**Done when:** Vitest unit tests for navigate, back/forward bounds, drawer toggle, palette open/close.
**Commit:** `feat(shell): zustand shell store`

### T03: Rail [P]
**What:** Implement Rail with 5 drawer icons + bottom (Home + Settings stub). Active state from store. aria-pressed.
**Where:** `src/features/shell/ui/Rail.tsx` + test
**Depends on:** T02
**Requirement:** SHELL-08
**Done when:** RTL test: clicking icon sets store drawer.
**Commit:** `feat(shell): rail`

### T04: TopBar [P]
**What:** Implement TopBar with breadcrumb (derived from view), New Note, ⌘K hint, Star toggle in note view.
**Where:** `src/features/shell/ui/TopBar.tsx` + test
**Depends on:** T02
**Requirement:** SHELL-15, 16, 17
**Done when:** RTL test for both view kinds.
**Commit:** `feat(shell): topbar`

### T05: DrawerHost [P]
**What:** Render the active drawer based on store. Outside-click + Esc close. Focus trap when open. Each drawer body imported from `src/features/drawers/ui/*` (F07 will fill them; F04 only wires shells).
**Where:** `src/features/shell/ui/DrawerHost.tsx` + test
**Depends on:** T02
**Requirement:** SHELL-05, 06, 07
**Done when:** RTL covers open/close, swap, focus trap.
**Commit:** `feat(shell): drawer host`

### T06: useShortcuts hook [P]
**What:** Bind ⌘K, ⌘N, ⌘O, ⌘\\, `?` via tinykeys; respect input focus (skip when target is editable except ⌘K which always opens).
**Where:** `src/features/shell/hooks/useShortcuts.ts` + test
**Depends on:** T02
**Requirement:** SHELL-09, 18, 19, 20, 21
**Done when:** Tests fire keydown via RTL, assert store changes.
**Commit:** `feat(shell): global shortcuts`

### T07: CommandPalette
**What:** cmdk-based modal. Sources aggregated from `vaultStore`, `indexStore.tags`, `commandsRegistry`. Empty-query default sections. Fuzzy match with fuzzysort. Enter dispatches action. Esc closes; focus restore.
**Where:** `src/features/shell/ui/CommandPalette.tsx`, `src/features/shell/commands/registry.ts`, tests
**Depends on:** T02, T06
**Requirement:** SHELL-09..14, 24
**Done when:** Component test: typing filters; enter on note routes; no-match shows CTA.
**Commit:** `feat(shell): command palette`

### T08: HelpModal
**What:** Modal listing all shortcuts grouped by category. Triggered by `?`.
**Where:** `src/features/shell/ui/HelpModal.tsx`
**Depends on:** T06
**Requirement:** SHELL-21
**Done when:** Snapshot test.
**Commit:** `feat(shell): help modal`

### T09: Toaster + IPC error sink
**What:** Mount sonner. Subscribe to a global error channel (`client.events.on('error.*')`). Push toasts on errors. Max 3 visible.
**Where:** `src/features/shell/ui/Toaster.tsx`, `src/shared/ipc/errors.ts`
**Depends on:** T01
**Requirement:** SHELL-22
**Done when:** Test fires synthetic error event, asserts toast.
**Commit:** `feat(shell): toaster + global error sink`

### T10: EmptyVault state
**What:** Centered card with "Open Vault" button, hides rail/topbar/drawers.
**Where:** `src/features/shell/ui/EmptyVault.tsx`
**Depends on:** T02
**Requirement:** SHELL-23
**Done when:** Renders when `vaultStore.path === null`.
**Commit:** `feat(shell): empty vault state`

### T11: ViewRouter
**What:** Component that reads `shellStore.view` and renders `<HomeView />` or `<NoteView noteId={...} />` or `<EmptyVault />`. Handles loading transitions.
**Where:** `src/features/shell/ui/ViewRouter.tsx`
**Depends on:** T02
**Requirement:** SHELL-01, 02, 03, 04
**Done when:** Tests for each branch.
**Commit:** `feat(shell): view router`

### T12: Compose Shell
**What:** `src/features/shell/index.tsx` exports `<Shell />` composing Rail + TopBar + ViewRouter + DrawerHost + Palette + Toaster + HelpModal. Mount in `App.tsx`.
**Where:** `src/features/shell/index.tsx`, `src/app/App.tsx`
**Depends on:** T03..T11
**Done when:** App boots into Layout C identical to prototype.
**Commit:** `feat(shell): compose shell layout`

### T13: E2E shell smoke
**What:** Playwright spec opening fixture vault: ⌘K opens palette → type → enter on a note → Note view → Esc → Home.
**Where:** `tests/e2e/shell/palette-flow.spec.ts`
**Depends on:** T12
**Done when:** Green locally + CI.
**Commit:** `test(shell): e2e palette flow`

### T14: Window-state persistence
**What:** Install + register `tauri-plugin-window-state`; on app `created` validate position vs monitors, recenter if off-screen.
**Where:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`
**Depends on:** T13
**Requirement:** added by F13 (SETTINGS-09/10) but lives in shell wiring
**Done when:** Manual test — resize+move, restart, geometry preserved.
**Commit:** `feat(shell): window state persistence`
