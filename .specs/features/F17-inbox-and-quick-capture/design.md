# F17 — Design

## Architecture overview

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React)                                   │
│                                                     │
│  drawersStore.selectedFolder ─────┐                 │
│                                   ▼                 │
│  defaultNewNoteFolder() ── createAndOpenNote()      │
│                                   │                 │
│  NoteMetaPanel (Folder field) ────┤                 │
│                                   ▼                 │
│  client.notes.create / notes.move (existing IPC)    │
└─────────────────────────────────────────────────────┘
                         ▲
   tauri://event "tray:quick-capture"
                         │
┌─────────────────────────────────────────────────────┐
│  Rust (src-tauri)                                   │
│                                                     │
│  setup() ── tray::TrayIconBuilder ── menu (3 items) │
│                                                     │
│  setup() ── tauri-plugin-global-shortcut            │
│           └─ CmdOrCtrl+Shift+I ── show window       │
│                                ── emit "tray:quick" │
│                                                     │
│  window CloseRequested handler ── hide(), prevent() │
└─────────────────────────────────────────────────────┘
```

## Component changes

### Frontend

**`src/features/drawers/state/drawersStore.ts`**

- Add `selectedFolder: string | null`.
- Add `selectFolder(path: string | null)`.
- Reset on vault change (we don't subscribe vault here; `reset()` already clears state and is called on vault unload).

**`src/features/drawers/ui/FolderNode.tsx`**

- Highlight when `selectedFolder === node.path` (existing tokens: ring + slightly stronger bg).
- On click on the folder row: `selectFolder(node.path)` AND `toggleFolder(node.path)`. Both behaviours are kept; selection becomes a side-effect of opening it.
- Clicking a note inside a folder leaves selection alone (don't auto-select).

**`src/features/drawers/ui/FoldersDrawer.tsx`**

- A "Root" pill at the top that visually represents `selectedFolder === null`. Clicking clears selection.
- ESC handler on the section's `keydown` clears the selection.

**`src/features/note-ops/services/createAndOpenNote.ts`** (extend existing)

- New helper `defaultNewNoteFolder()` reads `useDrawersStore.getState().selectedFolder` and returns it or `"Inbox"`.
- `createAndOpenNote(opts?)` defaults `opts.folder` to `defaultNewNoteFolder()` when not provided.
- All call-sites that currently pass an empty `folder: ""` should drop that override and rely on the default. Wikilink popover still passes its own folder (file-relative target).

**`src/features/note-view/ui/NoteMetaPanel.tsx`**

- New child `<NoteFolderField />` (own file). Reads the open note's folder from `vaultStore.notes`. Shows a `<select>` with `Root` + every distinct `note.folder` in the current vault, deduped + sorted. On change, calls a new service `moveOpenNote(noteId, destFolder)` that:
  1. resolves note path from `vaultStore`,
  2. calls `client.notes.move({ notePath, destFolder })`,
  3. `await loadNotes()`,
  4. re-navigates to the same id (id is stable across move; path is not),
  5. pushes a toast `Moved to <destFolder or 'Root'>`.
- On error, push an error toast and roll back the select to current value (controlled select).

**`src/features/note-ops/services/moveOpenNote.ts`** (new) — encapsulates the above.

**Tray-event listener (frontend side):**

- New module `src/features/quick-capture/services/registerQuickCapture.ts` listens to Tauri event `quick-capture:new` and calls `createAndOpenNote({ folder: "Inbox" })`. (Always Inbox for tray/global-shortcut, regardless of `selectedFolder`. The user's intent is "drop it somewhere I'll triage later".)
- Mounted from `main.tsx` after the IPC client is ready (alongside `installThemeRuntime`).

### Backend (Rust)

**`src-tauri/Cargo.toml`**

- Add `tauri-plugin-global-shortcut = "2"`.

**`src-tauri/capabilities/default.json`**

- Add `"global-shortcut:default"` permission.
- (`core:tray` and `core:menu` are part of `core:default`.)

**`src-tauri/src/lib.rs`**

- Plugin: `.plugin(tauri_plugin_global_shortcut::Builder::new().build())`.
- In `setup`:
  - Build a 3-item menu: Quick capture, Show Cork, Quit Cork.
  - Build a `TrayIconBuilder` with that menu, register click handler that toggles main window visibility.
  - Register `CmdOrControl+Shift+KeyI` global shortcut whose handler emits `quick-capture:new` to the main window AND ensures it's shown + focused.
  - Wire `WindowEvent::CloseRequested` on the main window: call `api.prevent_close()` and `window.hide()`.
- New helper `show_main_window(app)` that: gets main window, `unminimize`, `show`, `set_focus`, ensures visible (existing helper).

### Existing assets reuse

- The Inbox folder doesn't need a Rust change. `notes_create` in `src-tauri/src/vault/notes.rs` already creates the folder if missing (fs::create_dir_all). To verify in the design phase rather than at run time:

```rust
fs::create_dir_all(folder_abs)?; // already there
```

If not present, we add it. That's a small Rust delta; flagged as task `f17-fs-mkdir-verify`.

## Data flow examples

### Quick capture from minimised state

1. User in another app presses `Cmd+Shift+I`.
2. Tauri `global-shortcut` handler fires in Rust.
3. Rust calls `show_main_window(app)`.
4. Rust emits `quick-capture:new` to the main window.
5. Frontend listener receives event, calls `createAndOpenNote({ folder: "Inbox" })`.
6. `client.notes.create({ folder: "Inbox" })` → file at `<vault>/Inbox/Untitled-N.md`.
7. `vaultStore.loadNotes()` refreshes.
8. `useShellStore.navigate({ kind: "note", id: <new id> })`.
9. `Editor.tsx` mount-effect opens the buffer; CodeMirror gets focus from existing `view.focus()` call.

### Move from `NoteMetaPanel`

1. User opens note `notes/draft.md`.
2. NoteFolderField shows current folder = `"notes"`. Dropdown lists all folders.
3. User picks `"archive"`.
4. `moveOpenNote(id, "archive")`:
   - `client.notes.move({ notePath: "/abs/.../notes/draft.md", destFolder: "archive" })` → returns new `FolderPath`.
   - `vaultStore.loadNotes()` rehydrates.
   - `shellStore.navigate({ kind: "note", id })` re-renders NoteView with new path.
   - Toast: "Moved to archive".

## Testing strategy

| Concern | Approach |
| --- | --- |
| `defaultNewNoteFolder()` returns selected or "Inbox" | unit |
| `createAndOpenNote` defaults to Inbox | unit (mock `client.notes.create`) |
| `moveOpenNote` calls `notes.move` and re-navigates | unit (mock client + stores) |
| `selectedFolder` toggling in store | unit |
| `NoteFolderField` renders folders + handles change | RTL test |
| FolderNode highlights selectedFolder | RTL test |
| Tray icon, global shortcut, close-to-tray | manual smoke test (Tauri runtime; not in unit tests) |

Coverage target: maintain existing rate. New tests focus on the frontend pieces; Rust changes are exercised by the existing build + manual smoke.

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| `tauri-plugin-global-shortcut` plugin permission missing → silent failure | Add `global-shortcut:default` to capabilities; verify in dev build. |
| Hide-on-close conflicts with `tauri-plugin-window-state` | The plugin saves on `Drop` — since we hide instead of destroy, persistence still happens on real quit. Verified by reading the plugin readme. |
| macOS tray template icon contrast | Reuse `icons/32x32.png` for v1; flag a polish ticket for a proper template icon. |
| Race: shortcut fires before vault loaded | `createAndOpenNote()` early-returns if `vaultStore.path` is null; user just sees window come up on Home. Acceptable. |
| Wikilink popover passes `folder: ""` deliberately for "next to current note" — must not be replaced with Inbox | Only change call-sites that pass `""` as a "no folder" sentinel for new notes from the global "New note" entry points. Keep Wikilink and Daily logic intact. |

## Open questions resolved by autopilot

- **Inbox path:** literal `"Inbox"` at vault root. Not configurable in v1.
- **Shortcut:** `CmdOrCtrl+Shift+KeyI`. Not configurable in v1.
- **Status field:** out of scope; only the Folder selector ships.
- **Drag-drop notes:** out of scope.
- **Quick-capture window vs main window:** main window. Simpler, reuses everything.
- **Tray-as-default close:** yes on macOS; preserved current behaviour on other platforms.
