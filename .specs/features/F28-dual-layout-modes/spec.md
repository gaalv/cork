# F28 — Dual layout modes (Focus / Triage)

## Overview

Cork today ships a single Linear-style 2-column shell (Rail + ViewRouter, with
transient drawers). The user values the focus this gives note-writing but
keeps gravitating to the prototype's 3-column "Inkdrop" layout (sidebar +
notes list + editor) for browsing/triage workflows.

Rather than pick one, we ship **both as user-selectable layout modes**:

- `focus` — the current 2-column Linear/Obsidian-style shell (default).
- `triage` — a 3-column Inkdrop/Bear-style shell with an always-visible folder
  tree and notes list flanking the editor.

The mode is a per-app setting persisted across sessions. All existing features
work in both modes; drawers behave differently per mode (overlay in `focus`,
inline filter sources in `triage`).

---

## Requirements

### R1 — Layout mode setting

- **R1.1** A new `layoutMode: 'focus' | 'triage'` field is added to the app
  settings store and persisted via the existing `app_settings` IPC commands.
- **R1.2** Default value is `'focus'` for both new and upgraded installs (the
  current behaviour).
- **R1.3** A new toggle appears in the Settings panel under a "Appearance" or
  "Layout" subsection. Choices: "Focus mode (single editor)" and "Triage mode
  (sidebar + list + editor)" with a one-line description each.
- **R1.4** Switching the toggle takes effect immediately without app reload.
- **R1.5** When `triage` mode is selected but the viewport width is below
  `1100px`, the shell silently falls back to `focus` mode rendering (state
  remains `triage` so the user sees triage on a larger window again).

### R2 — Triage mode shell composition

- **R2.1** When `layoutMode === 'triage'` and viewport ≥ 1100px, the shell
  renders three columns: `Rail | NavPane | ListPane | ViewRouter`.
- **R2.2** `NavPane` (left, default 240px) shows the persistent navigation:
  folder tree, tag list, and the existing "Pinned/Recent/Inbox" sidebar
  shortcuts. It mirrors the data sources used by the current drawers.
- **R2.3** `ListPane` (middle, default 320px) shows a notes list filtered by
  the current `NavPane` selection (a folder, a tag, or a built-in shortcut
  like "Recents" or "Pinned"). When no selection is made, it shows the
  full vault sorted by mtime DESC.
- **R2.4** `ViewRouter` (right, fills remaining space) renders the same views
  as in `focus` mode: home / note / calendar / todos / graph.
- **R2.5** `Rail` and `TopBar` are present in both modes with the same
  contents and behaviour.

### R3 — NavPane content

- **R3.1** A "Shortcuts" section lists: Pinned, Recent, Inbox (matches
  prototype LayoutThreePane lines 53–57).
- **R3.2** A "Notebooks" section renders the folder tree from the existing
  vault index. Folders are clickable, expandable for nested ones, and show a
  count of notes.
- **R3.3** A "Tags" section renders top tags (limit 20) with counts; clicking
  a tag scopes the `ListPane` to that tag.
- **R3.4** Selecting any item updates a new shared store
  (`triageStore.selection`) and the `ListPane` re-queries accordingly.
- **R3.5** Default selection is "Recent" so the list pane is never empty.

### R4 — ListPane content

- **R4.1** The list shows one row per matching note with: title (1 line,
  truncated), excerpt (1–2 lines, truncated), small tag pills (up to 2),
  relative date (e.g. "2h", "yesterday").
- **R4.2** Header shows: current scope label (e.g. "Inbox · 4 notes",
  "#meetings · 12 notes"), and a sort dropdown defaulting to "Updated".
- **R4.3** Clicking a row navigates `ViewRouter` to `{ kind: 'note', id }`
  and visually marks the row as selected.
- **R4.4** A search/filter input at the top filters the current scope by
  title substring (case-insensitive).
- **R4.5** Empty state: a brief "No notes here yet" message.

### R5 — Resizable splitters

- **R5.1** The borders between Rail/NavPane and NavPane/ListPane and
  ListPane/ViewRouter are draggable to resize each pane.
- **R5.2** Pane widths persist across sessions via the same `app_settings`
  store, keyed as `triageNavWidth` and `triageListWidth`.
- **R5.3** Pane widths are clamped to sensible min/max values (NavPane:
  180–360px; ListPane: 240–480px).
- **R5.4** Reset is achievable by clearing the values via developer console;
  no UI button is required for v1.

### R6 — Drawer behaviour per mode

- **R6.1** In `focus` mode, drawers (Search, Folders, Recent, Starred, Tags)
  behave exactly as today (overlay on top of `ViewRouter`).
- **R6.2** In `triage` mode, the Folders / Tags / Recent / Starred drawers
  are redundant with the `NavPane`. Their Rail buttons select the matching
  `NavPane` section instead of opening an overlay drawer.
- **R6.3** The Search drawer (and Command Palette) remain available in both
  modes as overlays.

### R7 — View compatibility

- **R7.1** All existing views (`home`, `note`, `calendar`, `todos`, `graph`)
  render correctly in both layout modes inside the right column.
- **R7.2** No view depends on the absence of `NavPane`/`ListPane` — they
  receive the available width and adapt with their existing responsive
  styles.
- **R7.3** Tests for each view that previously assumed a specific
  shell composition continue to pass.

### R8 — Persistence and migration

- **R8.1** Existing users (vault settings missing `layoutMode`) get
  `layoutMode = 'focus'` as the default — no behaviour change.
- **R8.2** Pane widths default to 240/320px when missing.

### R9 — Accessibility & keyboard

- **R9.1** A new shortcut `Cmd+Shift+M` toggles between `focus` and `triage`
  (M for "mode"; `Cmd+Shift+L` is already taken by theme cycle).
- **R9.2** Splitter handles have `role="separator"` and `aria-orientation`,
  and are operable via keyboard arrows when focused (left/right adjusts by
  16px).
- **R9.3** Tab order in `triage`: Rail → NavPane → ListPane → ViewRouter.

---

## Out of scope

- Reordering or hiding sections of the NavPane.
- A "two-pane" intermediate mode (NavPane + Editor without ListPane).
- Customising column colours/themes per mode.
- Drag-and-drop notes between folders from the ListPane (already covered by
  separate F12 logic; not duplicated here).

## Acceptance

- The user can switch between `focus` and `triage` via Settings or
  `Cmd+Shift+L` and see the layout change immediately.
- All existing tests pass in both modes (the default mode for tests stays
  `focus`).
- New tests cover: triageStore selection, ListPane filtering by scope,
  splitter persistence, viewport fallback at <1100px, and drawer-button
  behaviour per mode.
