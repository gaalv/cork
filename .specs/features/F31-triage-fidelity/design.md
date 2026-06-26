# F31 — Design

## Architecture overview

```
┌───────────────────────────────────────────────────────────────────┐
│ Shell (features/shell/index.tsx)                                  │
│                                                                   │
│   ShellChrome reads `useAppSettingsStore.settings.layout.mode`    │
│   ─ "focus"  → Rail + TopBar + DrawerHost + ViewRouter            │
│   ─ "triage" → <TriageBody/> ONLY (no Rail, no TopBar)            │
│                                                                   │
│   ┌──────────── TriageBody (triage mode) ────────────┐            │
│   │ Splitter                                         │            │
│   │  ┌───────────┬──────────────┬────────────────┐   │            │
│   │  │ NavPane   │ ListPane     │ TriageMain     │   │            │
│   │  │           │              │ (NoteView OR   │   │            │
│   │  │ • brand   │ • search     │  Placeholder)  │   │            │
│   │  │ • CTA     │ • cards      │                │   │            │
│   │  │ • shortcuts│ • auto-select│                │   │            │
│   │  │ • folders │ • tag pills  │                │   │            │
│   │  │ • tags    │              │                │   │            │
│   │  │ • footer  │              │                │   │            │
│   │  └───────────┴──────────────┴────────────────┘   │            │
│   │   + <TriageToolOverlay/> (modal: graph/cal/todos)│            │
│   └──────────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────────┘
```

The Rail / TopBar branch lives entirely behind the `layout.mode === "triage"` guard in `ShellChrome`; nothing else in the shell needs to know about the mode.

## Key components

### `ShellChrome` (features/shell/index.tsx)

Single switch point. When `mode === "triage"`, renders only `<TriageBody/>`; modal hosts (palette, settings, generate-note, help, toaster, bulk actions bar) stay mounted at the shell level so they work in both modes.

### `NavPane` (features/shell/ui/triage/NavPane.tsx)

```
┌───────────────────────────┐
│  Cork  [vault]  <sync>    │  brand row (R3)
│  ┌───── New note ─────┐   │  primary CTA (R4)
│  └────────────────────┘   │
│                           │
│  SHORTCUTS                │  (R5)
│   ★ Pinned                │
│   ⌚ Recent                │
│   📥 Inbox  (count)        │
│                           │
│  FOLDERS                  │  (R5) — was "Notebooks"
│   📁 Projects (3)         │
│   📁 Daily    (1)         │
│                           │
│  TAGS                     │
│   # meetings (5)          │
│   # ideas    (2)          │
│                           │
│  …/notes/work  2 notes ⚙  │  footer: path · count · gear (R6)
└───────────────────────────┘
```

- Brand row: wordmark + "vault" chip + `SyncIndicator`. **No logo glyph** until project has one.
- "New note" CTA invokes `createAndOpenNote({ folder })` scoped to the active triage folder selection (root otherwise).
- Sections in order: Shortcuts, Folders, Tags. Section title "Folders" replaces legacy "Notebooks".
- Footer renders `formatVaultPath(path)` on the left, total note count on the right, settings gear on the far right. `formatVaultPath` shows `…/<parent>/<basename>` for deep paths and the full path otherwise; full path is in the `title` attribute for hover discovery.

### `ListPane` (features/shell/ui/triage/ListPane.tsx)

- Header: combo search input ("Search this view…") + clickable `⌘K` chip that opens the global palette (R7).
- Loader: `loadList(selection)` dispatches per kind (shortcut / folder / tag); results are pushed through `enrichNotes` (shared with Home, R9).
- Rows: title + HH:mm/relative time, 2-line `line-clamp` excerpt, up to 3 `#tag` pills, 2-px accent left border when active (R8).
- After enrichment, if no note is selected (or current selection left the list), auto-navigates to the first row — but only when no overlay modal is open (R10). The overlay-aware check prevents Graph/Calendar/Todos from being unexpectedly dismissed.

### `TriageBody` (features/shell/ui/triage/TriageBody.tsx)

- Composes `Splitter` with three panels (nav fixed 200–360, list 280–480, view fill). Persists widths via `useAppSettingsStore.setTriageWidths`.
- `TriageMain` switches between `NoteView` and `NotePlaceholder` based on `useShellStore.view`.
- `TriageToolOverlay` watches `useTriageOverlayStore`; renders a full-bleed modal (absolute over the body, `z-30`) with `Esc` and backdrop-click to close. Hosts `GraphView` / `CalendarView` / `TodosView` without disturbing the third column underneath (R12).

### Command palette additions

- New `"Tools"` section in `commandsRegistry` covering `open-graph`, `open-calendar`, `open-todos`. Section order: `Todos · Recents · Pinned · Commands · Tools · AI · Tags · Vault Actions` (R13).
- New `open-calendar` action id routes through `openToolView("calendar")` → overlay in triage, normal navigation in focus.
- `commandsRegistry` is no longer sliced — the full list is exposed so Tools entries always appear in the palette default view.

### Keyboard shortcuts

- `Cmd+Shift+G` → `openToolView("graph")` (already present).
- `Cmd+Shift+C` → `openToolView("calendar")` (new, R13).
- `Cmd+Shift+T` (Open todos) stays as a **native tray accelerator** in `src-tauri/src/lib.rs` rather than a renderer shortcut — preserves macOS global behaviour (matches the F25 contract).
- `Cmd+Shift+M` continues to flip layout modes (F28).

## Data flow

```
useAppSettingsStore (layout.mode)
        │
        ▼
   ShellChrome
        │
        ├── focus  → Rail / TopBar / DrawerHost / ViewRouter
        │
        └── triage → TriageBody
                        │
                        ├── useTriageStore (selection)
                        ├── useShellStore  (active view)
                        ├── useVaultStore  (path, notes count)
                        ├── useTriageOverlayStore (graph/calendar/todos overlay)
                        └── enrichNotes (shared service, also used by Home)
```

## Trade-offs

- **No logo glyph in brand row.** The project does not have one yet; adding a placeholder noise glyph would set the wrong expectation. Revisit when branding lands (M10).
- **Footer path uses last-2-segments instead of `~/...` tilde.** Doing `~`-substitution requires querying the OS home dir via a new IPC call. The `…/notes/work` form keeps the footer informative without adding IPC. Full path stays in the `title` tooltip.
- **Tools modal is a single-instance overlay.** Switching from Graph to Calendar dismisses the previous overlay; we did not implement a tab strip inside the modal. Keeps the surface small; the user can always re-trigger via shortcut/palette.
- **`Cmd+Shift+T` stays tray-only.** Wiring it again in the renderer would double-fire when both layers are bound. Tray remains the canonical entry.

## Tests

- `NavPane.test.tsx`: covers shortcut/folder/tag selection + the new footer renders path, count, and settings gear.
- `ListPane.test.tsx`: scope label, enriched cards, search, auto-select.
- `CommandPalette.test.tsx`: smoke; section ordering is data-driven via `groupItems`, so adding "Tools" needs no separate test.
- `useShortcuts.test.tsx`: smoke for existing shortcuts; Cmd+Shift+C reuses the same plumbing as Cmd+Shift+G and is covered transitively.
- E2E (deferred): a Playwright assertion that triage mode hides Rail/TopBar lives in the existing focus-mode E2E suite and was kept green.
