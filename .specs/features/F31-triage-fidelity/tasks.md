# F31 — Tasks

Atomic, verifiable, ordered. Each task = one commit with the
Conventional-Commits subject and the standardised footer.

Tasks T1–T6 shipped incrementally in prior sessions; T7–T9 closed the
remaining gaps to mark F31 COMPLETE.

`[P:group]` marks tasks that can run concurrently within a group.

---

## T1 — Hide Rail + TopBar in triage mode

- Edit `src/features/shell/index.tsx`:
  - Extract `<ShellChrome/>` from the main shell return.
  - Branch on `useAppSettingsStore.settings.layout.mode`: triage renders only `<TriageBody/>`; focus keeps the Rail/TopBar layout.
  - Modal hosts (CommandPalette, GenerateNoteModal, HelpModal, SettingsPanel, Toaster, BulkActionsBar) stay outside the branch.
- Verify: `pnpm typecheck && pnpm exec vitest run src/features/shell`.
- Commit: `feat(shell): hide rail and topbar in triage mode`.
- Status: **DONE** (shipped in prior session).

## T2 [P:nav] — NavPane brand row + New note CTA + Folders rename

- Edit `src/features/shell/ui/triage/NavPane.tsx`:
  - Add brand row (wordmark + "vault" chip + `<SyncIndicator/>`).
  - Add primary "New note" CTA calling `createAndOpenNote({ folder })`.
  - Rename "Notebooks" section heading to "Folders".
  - Order sections: Shortcuts (Pinned/Recent/Inbox) → Folders → Tags.
- Verify: NavPane test passes; visual sanity in `pnpm tauri dev`.
- Commit: `feat(shell): nav pane brand row, new note CTA, folders rename`.
- Status: **DONE** (shipped in prior session).

## T3 [P:list] — ListPane enriched cards + auto-select

- Edit `src/features/shell/ui/triage/ListPane.tsx`:
  - Render rows as cards: title + HH:mm/relative time + 2-line excerpt + up to 3 tag pills.
  - Active row uses 2-px accent left border + soft accent bg.
  - On enrichment, navigate to first row when no note is active OR the active note left the list — skipped while a triage overlay is open.
- Extract `enrichNotes` to `src/features/notes/services/enrichNotes.ts` (shared with Home).
- Verify: `pnpm exec vitest run src/features/shell/ui/triage/ListPane`.
- Commit: `feat(shell): enriched note cards and auto-select for triage list`.
- Status: **DONE** (shipped in prior session).

## T4 [P:overlay] — Triage tool overlay (Graph / Calendar / Todos)

- New `src/features/shell/state/triageOverlayStore.ts` exposing `{ kind, open, toggle, close }` over `"graph" | "calendar" | "todos"`.
- New `src/features/shell/services/openToolView.ts` that routes `openToolView(kind)` to the overlay store in triage mode, otherwise navigates via `useShellStore`.
- Edit `TriageBody.tsx` to mount `<TriageToolOverlay/>` with Esc/backdrop close + headers per overlay.
- Edit shortcut handlers so `Cmd+Shift+G` routes through `openToolView` (replacing the old direct navigation).
- Verify: vitest run for the shell suite.
- Commit: `feat(shell): tool overlay for triage (graph/calendar/todos)`.
- Status: **DONE** (shipped in prior session).

## T5 — NotePlaceholder for empty third column

- Edit `TriageBody.tsx`: add `<NotePlaceholder/>` rendered by `TriageMain` whenever `view.kind !== "note"`.
- Placeholder shows "Select a note to start reading" + `⌘N` hint.
- `data-testid="triage-empty-placeholder"` for E2E.
- Verify: vitest.
- Commit: `feat(shell): empty placeholder for triage third column`.
- Status: **DONE** (shipped in prior session).

## T6 — ListPane ⌘K chip + scope label

- Edit `ListPane.tsx`: placeholder copy "Search this view…", `⌘K` clickable chip that calls `useShellStore.openPalette()`, scope label `triageScopeLabel(selection) · N notes`.
- Verify: vitest.
- Commit: `feat(shell): triage list ⌘K chip and scope label`.
- Status: **DONE** (shipped in prior session).

## T7 — NavPane footer (vault path · count · gear) ✅ this session

- Edit `src/features/shell/ui/triage/NavPane.tsx`:
  - Read `useVaultStore.path` and `useVaultStore.notes.length`.
  - Render footer row: vault path (left, smart-truncated via `formatVaultPath`) · note count (center/right) · settings gear button (far right).
  - Full path stays in the `title` attribute for hover discovery.
- Add `formatVaultPath` helper at the bottom of NavPane: returns full path if ≤ 2 segments, otherwise `…/<parent>/<basename>`. POSIX/Windows-agnostic via slash normalisation.
- Extend `NavPane.test.tsx` with a footer assertion (path text, count text, gear present).
- Verify: `pnpm typecheck && pnpm lint && pnpm exec vitest run src/features/shell/ui/triage/NavPane.test.tsx`.
- Commit: `feat(shell): nav pane footer with vault path and note count`.

## T8 — Palette "Tools" section + open-calendar command ✅ this session

- Edit `src/features/shell/commands/registry.ts`:
  - Add `"open-calendar"` to `CommandActionId`.
  - Extend `CommandRegistryItem.section` union with `"Tools"`.
  - Move `open-graph` / `open-todos` and the new `open-calendar` into `section: "Tools"`.
- Edit `src/features/shell/ui/CommandPalette.tsx`:
  - Insert `"Tools"` into `groupItems` ordering (`… Commands · Tools · AI …`).
  - Add a `id === "open-calendar"` branch in `runCommand` calling `openToolView("calendar")`.
  - Stop slicing the registry — emit it in full so Tools entries always appear in the default view.
- Verify: `pnpm typecheck && pnpm exec vitest run src/features/shell`.
- Commit: `feat(shell): palette tools section + open-calendar command`.

## T9 — Cmd+Shift+C shortcut for Calendar ✅ this session

- Edit `src/features/shell/hooks/useShortcuts.ts`: register `"$mod+Shift+c"` mirroring the `$mod+Shift+g` handler but calling `openToolView("calendar")`.
- Edit `src/features/shell/ui/HelpModal.tsx`: add `["⌘⇧C", "Open Calendar view"]` to the Navigation group.
- Verify: `pnpm exec vitest run src/features/shell/hooks/useShortcuts.test.tsx`.
- Commit: `feat(shell): cmd+shift+c shortcut to open calendar overlay`.

## T10 — End-to-end verification ✅ this session

- Run `pnpm typecheck && pnpm lint && pnpm exec vitest run`.
- Sanity-check the lint baseline (added `/* global */` directive to `scripts/check-bundle-size.mjs` so the existing lint contract still passes — pre-existing breakage unblocked).
- Update STATE.md (mark Quick Task) and ROADMAP.md (F31 → COMPLETE; M9 → COMPLETE).

---

## Dependency graph

```
T1 ─┬─ T2,T3 ──┐
    │          │
    ├─ T4 ─────┼── T5,T6 ── T7 ── T8 ── T9 ── T10
    │          │
    └──────────┘
```

T2/T3 parallel after T1. T4 needs the new store/service but does not
touch NavPane/ListPane internals. T7/T8/T9 are the closing trio that
landed in this session.
