# F28 — Design

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Shell (features/shell/index.tsx)                                    │
│                                                                     │
│  ┌──────┐  ┌─────────────────────────────────────────────────────┐ │
│  │ Rail │  │ TopBar                                              │ │
│  │      │  ├─────────────────────────────────────────────────────┤ │
│  │      │  │                                                     │ │
│  │      │  │   <ShellBody mode={layoutMode}>                     │ │
│  │      │  │                                                     │ │
│  │      │  │   ┌────── focus mode ───────┐                       │ │
│  │      │  │   │ DrawerHost (overlay)    │                       │ │
│  │      │  │   │ ViewRouter              │                       │ │
│  │      │  │   └─────────────────────────┘                       │ │
│  │      │  │                                                     │ │
│  │      │  │   ┌────── triage mode ──────┐                       │ │
│  │      │  │   │ NavPane │ ListPane │ VR │  + DrawerHost overlay │ │
│  │      │  │   └─────────────────────────┘  (search only)        │ │
│  │      │  │                                                     │ │
│  │      │  └─────────────────────────────────────────────────────┘ │
│  └──────┘                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

`ShellBody` is the single switch point. It reads `layoutMode` from
`useAppSettingsStore` and viewport width from a small `useViewportWidth`
hook, then renders the appropriate composition.

## Key components

### `useViewportWidth()`

Tiny custom hook around `window.innerWidth` + a debounced `resize` listener
(150ms). Returns `number`. Used by `ShellBody` to enforce R1.5 (fallback at
<1100px). Co-located with `ShellBody` in `features/shell/hooks/`.

### `ShellBody`

```tsx
function ShellBody() {
  const mode = useAppSettingsStore((s) => s.layoutMode);
  const width = useViewportWidth();
  const effective = width < 1100 ? "focus" : mode;
  return effective === "triage" ? <TriageBody /> : <FocusBody />;
}
```

`FocusBody` wraps the existing JSX from `Shell` (DrawerHost + ViewRouter).
`TriageBody` is new.

### `TriageBody`

```tsx
<Splitter
  panels={[
    { id: "nav", size: navWidth, min: 180, max: 360 },
    { id: "list", size: listWidth, min: 240, max: 480 },
    { id: "view", size: "fill" },
  ]}
  onResize={persistWidths}
>
  <NavPane />
  <ListPane />
  <ViewRouter />
</Splitter>
{drawer === "search" ? <DrawerHost /> : null}
```

Uses **react-resizable-panels** library (already-vetted React API,
keyboard-accessible, no DOM mutation hacks). If we want zero new deps, a
custom 60-line `Splitter` with native `pointermove` will work — design.md
prefers the lib for time-to-value but TASK will let us pick at execution
based on bundle/dep policy.

### `useTriageStore`

```ts
type Selection =
  | { kind: "shortcut"; id: "pinned" | "recent" | "inbox" }
  | { kind: "folder"; path: string }
  | { kind: "tag"; tag: string };

interface TriageState {
  selection: Selection;
  setSelection: (s: Selection) => void;
}
```

Default: `{ kind: "shortcut", id: "recent" }`.

### `NavPane`

Composes three sub-components, each reusing data hooks already used by the
existing drawers:

- `NavShortcuts` — three buttons, sets selection.
- `NavFolderTree` — reuses `useFolderTree()` from
  `features/drawers/hooks/useFolderTree.ts`. On row click → `setSelection({
  kind: "folder", path })`.
- `NavTagList` — reuses `useTagTree()` similarly. Limited to top 20 by
  count.

Active selection rendered with the same accent the prototype's
`LayoutThreePane` uses.

### `ListPane`

Subscribes to selection and queries notes accordingly:

```ts
async function loadList(selection: Selection): Promise<NoteEntry[]> {
  switch (selection.kind) {
    case "shortcut":
      if (selection.id === "pinned") return loadPinned();
      if (selection.id === "recent") return client.notes.recent(200);
      // inbox = root-level notes
      return (await client.notes.allPaged(0, 200)).filter(
        (n) => !n.folder
      );
    case "folder":
      return (await client.notes.allPaged(0, 500)).filter((n) =>
        n.folder.startsWith(selection.path)
      );
    case "tag":
      return client.notes.byTag(selection.tag);
  }
}
```

`client.notes.byTag` may not exist yet — DESIGN STEP: check
`shared/ipc/IpcContract.ts`. If absent, add a thin wrapper that calls
`client.notes.allPaged` then filters by reading the index store's tag set.

Selection sync with the active note: when the user opens a note via
`ViewRouter`, the row in `ListPane` is highlighted by matching `note.id`
against the current `shellStore.view`.

Search input uses local state, debounced 100ms, filters the loaded list by
title `includes` (case-insensitive).

### `Splitter`

If we go custom (preferred for zero deps):

```tsx
function Splitter({ panels, onResize, children }) {
  const [sizes, setSizes] = useState(panels.map((p) => p.size));
  // Render as: <div style={{display:'grid', gridTemplateColumns: ...}}>
  // Insert <SplitterHandle> between children.
  // SplitterHandle has pointer-events to drag, calls setSizes, throttled
  // onResize on dragend.
}
```

Persisted via `useAppSettingsStore.setLayoutWidths({nav, list})` →
`saveAppSettings`.

### `useAppSettingsStore` extension

Add to existing store:

```ts
layoutMode: "focus" | "triage";
triageNavWidth: number; // default 240
triageListWidth: number; // default 320
setLayoutMode(mode);
setTriageWidths(nav, list);
```

Persisted via the existing `appSettings.save` IPC. The Rust side already
accepts arbitrary keys in the JSON blob, so adding fields is non-breaking.

### Drawer behaviour split

In `Rail`, the click handlers for the drawer buttons (Folders/Tags/Recent/
Starred) check `layoutMode`:

- `focus` → `openDrawer(id)` (current behaviour)
- `triage` → `triageStore.setSelection(...)` mapping each drawer to a
  shortcut/section, no overlay opens.

Search button always opens the overlay regardless of mode.

### Keyboard shortcut

`Cmd+Shift+L` registered in `useShortcuts.ts`:

```ts
register("Mod+Shift+L", () =>
  useAppSettingsStore
    .getState()
    .setLayoutMode(
      useAppSettingsStore.getState().layoutMode === "focus"
        ? "triage"
        : "focus"
    )
);
```

## Data flow

```
[user clicks "Folders" Rail btn in triage]
        ↓
Rail handler reads layoutMode=triage
        ↓
triageStore.setSelection({kind:'shortcut', id:'recent'? no — open NavPane focus})
        ↓
NavPane is already visible; just focuses the folder tree section.
```

```
[user clicks a folder in NavPane]
        ↓
triageStore.setSelection({kind:'folder', path:'projects'})
        ↓
ListPane subscribes → loadList(selection) → setNotes(...)
        ↓
ListPane renders rows; active row stays in sync with shellStore.view.
```

```
[user clicks a row in ListPane]
        ↓
shellStore.navigate({kind:'note', id})
        ↓
ViewRouter renders <NoteView id=...>
        ↓
ListPane highlights matching row via id comparison.
```

## Non-goals / explicit deferrals

- **Drag-and-drop notes between folders from ListPane.** Already covered by
  F12 in the focus-mode drawer; not duplicated.
- **Multi-select in ListPane.** Stay single-select for v1.
- **Custom NavPane sections.** Deferred.

## Testing strategy

- Unit:
  - `useTriageStore`: default selection, setSelection.
  - `loadList()` per selection kind (mock client.notes).
  - `Splitter`: pointermove math, clamping to min/max.
  - `useViewportWidth`: resize listener cleanup.
- Component:
  - `NavPane`: clicking folder updates selection.
  - `ListPane`: shows scope label, filters by search, highlights active
    note.
  - `ShellBody`: respects mode + viewport fallback.
- Integration (existing test suite):
  - Render Shell with `layoutMode='triage'` and assert NavPane present.
  - Render Shell with `layoutMode='focus'` and assert no NavPane.
- E2E: not required for v1; Playwright will catch regressions in CI.

## Risks & mitigations

| Risk                                                                  | Mitigation                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Existing Shell tests break when DrawerHost wrapper changes            | Wrap focus-mode JSX 1:1 in `FocusBody`; tests still pass.     |
| Splitter pointer math is buggy on Linux/Windows                       | Use `pointercapture` API; add a unit test for clamping.       |
| Triage mode on small viewport looks broken                            | R1.5 fallback to focus mode at <1100px; document threshold.   |
| Each drawer's data hook isn't reusable as-is                          | Verify before TASKS phase; refactor only if needed.           |
| Performance: ListPane re-renders on every shellStore change           | `useShellStore(s => s.view, shallow)` with derived id only.   |
| `client.notes.byTag` doesn't exist                                    | Use index store tag set + `allPaged` filter in app code.      |

## Verification on each task

Each task in `tasks.md` lists its verification criteria (build, tests, or
visual). The execution phase commits per task with the standardised commit
message format from F26 (`feat(shell): ...`).
