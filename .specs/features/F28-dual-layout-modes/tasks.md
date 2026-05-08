# F28 — Tasks

Atomic, verifiable, ordered. Each task = one commit with the
Conventional-Commits subject and the standardised footer. Verification gates
follow each task; if a gate fails, fix before moving on.

Parallelisable groups are tagged `[P:groupName]`. Two tasks in the same
group can be implemented concurrently in different branches/sub-agents.

---

## T1 — Add `layoutMode` + triage widths to AppSettings types

- Edit `src/features/settings/state/settingsTypes.ts`:
  - Extend `AppSettings` with new top-level group:
    ```ts
    layout: {
      mode: "focus" | "triage";
      triageNavWidth: number;
      triageListWidth: number;
    }
    ```
  - Extend `DEFAULT_APP_SETTINGS.layout = { mode: "focus", triageNavWidth: 240, triageListWidth: 320 }`.
  - Add `"layout.mode"`, `"layout.triageNavWidth"`, `"layout.triageListWidth"` to `SettingKey` union.
- Edit `appSettingsStore.ts` `normalizeAppSettings` to read+default `layout`.
- Verify: `pnpm typecheck`.
- Commit: `feat(settings): add layout mode + triage widths to app settings`.

## T2 — Settings panel toggle + width persistence helpers

- Edit `src/features/settings/ui/SettingsPanel.tsx`: add a new "Layout"
  subsection with a 2-option control (Focus / Triage).
- Add helper actions on the store: `setLayoutMode(mode)` and
  `setTriageWidths({ nav?, list? })` that call `updateSettings({ layout })`.
- Verify: `pnpm typecheck && pnpm exec vitest run src/features/settings`.
- Commit: `feat(settings): user-facing layout-mode toggle in settings panel`.

## T3 — `useViewportWidth` hook

- New `src/features/shell/hooks/useViewportWidth.ts` — debounced (150ms)
  resize listener returning `number`. Initial value `window.innerWidth`.
- Unit test: `useViewportWidth.test.ts` — fakes `window.innerWidth`,
  dispatches `resize`, asserts return after debounce flush.
- Verify: `pnpm exec vitest run src/features/shell/hooks/useViewportWidth.test.ts`.
- Commit: `feat(shell): viewport width hook for layout fallback`.

## T4 [P:state] — `useTriageStore`

- New `src/features/shell/state/triageStore.ts` with `Selection` type and
  `setSelection`. Default: `{ kind: "shortcut", id: "recent" }`.
- Unit test alongside.
- Verify: vitest target.
- Commit: `feat(shell): triage selection store`.

## T5 [P:state] — `Mod+Shift+L` shortcut

- Edit `src/features/shell/hooks/useShortcuts.ts` to register the toggle
  shortcut wiring `setLayoutMode`.
- Update or add a minimal test in `useShortcuts.test.ts` (if exists) or
  inline assertion via Shell test.
- Commit: `feat(shell): keyboard shortcut to toggle layout mode`.

## T6 — Custom `Splitter` component

- New `src/features/shell/ui/Splitter.tsx`:
  - Props: `panels: Array<{ id; size: number | "fill"; min?; max? }>`,
    `onResize(sizes)`, children.
  - Renders as `display:grid` with computed `gridTemplateColumns`.
  - Inserts `<SplitterHandle>` between children; pointercapture-driven
    drag updates internal state; commits `onResize` on `pointerup`.
  - Keyboard: focused handle reacts to ArrowLeft/Right (16px steps).
  - Handles `aria-orientation="vertical"` and `role="separator"`.
- Unit test: drag math (clamp to min/max), keyboard, callback fires.
- Commit: `feat(shell): resizable splitter component`.

## T7 [P:nav] — `NavPane`

- New `src/features/shell/ui/triage/NavPane.tsx` composing:
  - `NavShortcuts` (Pinned / Recent / Inbox).
  - `NavFolderTree` reusing `useFolderTree`.
  - `NavTagList` reusing `useTagTree` (top 20 by count).
- Each click calls `useTriageStore.setSelection(...)`.
- Active section visually marked.
- Tests: clicking each kind updates the store.
- Commit: `feat(shell): nav pane for triage layout`.

## T8 [P:list] — `ListPane`

- New `src/features/shell/ui/triage/ListPane.tsx`:
  - Subscribes to `useTriageStore.selection`.
  - Loads list via the helper described in design.md (use
    `client.notes.allPaged`/`recent` + index store for tags).
  - Renders rows with title, excerpt, tag pills, relative date.
  - Header: scope label + count.
  - Search input (debounced 100ms) filters by title.
  - Active row = `useShellStore` view note id.
- Tests: scope label rendering, search filtering, row click navigates,
  empty state.
- Commit: `feat(shell): list pane for triage layout`.

## T9 — `TriageBody` composition

- New `src/features/shell/ui/TriageBody.tsx` that wires `Splitter +
  NavPane + ListPane + ViewRouter` and persists widths.
- Read `triageNavWidth` / `triageListWidth` from settings; on resize,
  call `setTriageWidths`.
- Test: renders three panes; resize callback fires `setTriageWidths`.
- Commit: `feat(shell): triage body composition`.

## T10 — `ShellBody` switch + integrate into Shell

- Refactor `src/features/shell/index.tsx`:
  - Extract current main JSX into `FocusBody`.
  - Add `ShellBody` that reads `layoutMode + viewportWidth` and renders
    `TriageBody` or `FocusBody`.
  - Replace inline JSX with `<ShellBody />`.
- Update `Shell.test.tsx` to mock `useViewportWidth` to a wide value and
  add a triage-mode test.
- Verify full vitest + typecheck.
- Commit: `feat(shell): mount layout switch in main shell`.

## T11 — Rail drawer button behaviour per mode

- Edit `src/features/shell/ui/Rail.tsx`:
  - For Folders/Tags/Recent/Starred buttons, branch on `layoutMode`:
    - focus → `openDrawer` (current).
    - triage → `triageStore.setSelection` to the corresponding
      shortcut/section (Folders → focus first folder?; Tags → first tag?;
      simpler: Folders → switch focus to NavPane folder section, set
      selection to last folder; Tags → set selection.kind=`tag` for top
      tag; Recent/Starred → shortcut). For v1 we just `setSelection` to
      the matching shortcut where it exists, otherwise no-op.
- Tests: button-click branches per mode.
- Commit: `feat(shell): rail buttons drive nav pane in triage mode`.

## T12 — End-to-end verification

- Run `cargo test --lib`, `pnpm typecheck && pnpm lint && pnpm exec vitest run`.
- Manual sanity: `pnpm tauri dev` (deferred to user).
- Commit: nothing (verification gate only).

---

## Dependency graph

```
T1 ─┬─ T2
    │
    ├─ T4 ──┐
    │      │
    │      └── T7,T8 ──┐
    │                  │
    ├─ T3 ──── T9 ─────┴── T10 ── T11 ── T12
    │
    └─ T6 ──── T9
```

T2/T4/T5/T6 can proceed in parallel after T1. T7/T8 in parallel after T4
(both consume the store but don't conflict). T9 needs T6+T7+T8. T10 needs
T3+T9. T11 needs T10.
