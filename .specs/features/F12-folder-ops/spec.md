# F12 — Folder Operations & Rename UX Specification

**Owner phase:** M3
**Depends on:** F02, F04, F07
**Status:** Draft

## Problem Statement

The vault is a folder tree, but v1's plan only exposes per-note operations (`notes.create/rename/trash`). Users need to create/rename/delete folders, move notes between folders (drag or menu), and rename notes via a proper UI dialog or inline-edit. Without these, even basic organization workflows are blocked.

## Goals

- [ ] `folders.create / rename / move / trash` IPC.
- [ ] FoldersDrawer (F07) supports right-click menu + inline rename for folders.
- [ ] Drag-and-drop a note onto a folder (in FoldersDrawer or NoteCard menu) moves it.
- [ ] Notes can be renamed via NoteView (click title in TopBar → input) and via NoteCard menu.
- [ ] All operations propagate via F02 watcher; index updates incrementally; wikilink propagation runs (F09) on rename.
- [ ] Bulk: select multiple notes in a drawer/grid (Shift/⌘ click) and apply move/delete/star.

## Out of Scope

| Feature                           | Reason  |
| --------------------------------- | ------- |
| Cut / copy / paste tree nodes     | v2      |
| Templates folder UI               | F10 covers daily template; broader templates v2 |
| Duplicate detection on move       | v2      |

---

## User Stories

### P1: Create folder ⭐ MVP

1. WHEN the user right-clicks a folder in FoldersDrawer (or root) → "New Folder" THEN system SHALL prompt for name and create `<parent>/<name>/` on disk.
2. WHEN name conflicts THEN show inline error; do not create.

### P1: Rename folder ⭐ MVP

1. WHEN the user picks "Rename" on a folder THEN system SHALL switch the row to an input pre-filled with name.
2. WHEN confirmed THEN call `folders.rename(oldPath, newName)`. All notes inside are reindexed via watcher.
3. WHEN the rename collides with sibling folder THEN return `Conflict`.
4. WHEN auto-rewrite is on AND any note paths inside changed THEN F09 propagation SHALL run for affected notes (filenames don't change, but folder displayed in some links may — handled by F09 because target_text is the title, not the path).

### P1: Move folder ⭐ MVP

1. WHEN user drags a folder onto another folder THEN call `folders.move(src, destParent)`.
2. WHEN destination is descendant of source THEN block + toast.

### P1: Trash folder ⭐ MVP

1. WHEN user picks "Move to Trash" THEN show confirmation listing N notes affected.
2. WHEN confirmed THEN call OS trash on the folder; index removes affected notes; watcher emits `removed` for each.

### P1: Move note (drag) ⭐ MVP

1. WHEN user drags a NoteCard or drawer row onto a folder in FoldersDrawer THEN call `notes.move(notePath, destFolder)`.
2. WHEN destination has same filename THEN return `Conflict`; UI prompts to rename.
3. WHEN move succeeds THEN F09 resolver pass updates `target_id` (filename unchanged → still resolves).

### P1: Rename note via UI ⭐ MVP

1. WHEN user clicks the title segment in the TopBar breadcrumb on the active note THEN it becomes an inline editable input (focus, select-all).
2. WHEN confirmed (Enter or blur) THEN call `notes.rename`. Cancel on Esc.
3. WHEN rename succeeds THEN F09 propagation runs (per its setting).
4. WHEN rename fails THEN restore previous title and toast the error.

### P2: Bulk selection

1. WHEN in AllNotesGrid or RecentDrawer the user holds Shift/⌘ and clicks rows THEN multiple are selected with a visible badge "<N> selected".
2. WHEN bulk menu opens THEN actions: Move…, Delete, Add Tag, Remove Tag, Pin/Unpin, Star/Unstar.
3. WHEN bulk Move is chosen THEN show a folder picker.

---

## Edge Cases

- WHEN dragging a folder onto its own parent (no-op): silently ignore.
- WHEN the user renames a folder to a hidden name (starts with `.`): block (we'd lose visibility per F02 rules).
- WHEN bulk delete includes the currently-open note: close NoteView and navigate to Home first.
- WHEN moving across drives: `rename` may fail; fall back to copy+delete.

---

## Requirement Traceability

| ID         | AC                                | Status  |
| ---------- | --------------------------------- | ------- |
| FOLDER-01  | Create folder                     | Pending |
| FOLDER-02  | Rename folder                     | Pending |
| FOLDER-03  | Folder rename conflict            | Pending |
| FOLDER-04  | Move folder                       | Pending |
| FOLDER-05  | Move folder cycle block           | Pending |
| FOLDER-06  | Trash folder                      | Pending |
| FOLDER-07  | Trash confirmation                | Pending |
| FOLDER-08  | Move note via drag                | Pending |
| FOLDER-09  | Move note conflict                | Pending |
| FOLDER-10  | Rename note inline (TopBar)       | Pending |
| FOLDER-11  | Rename failure recovery           | Pending |
| FOLDER-12  | Bulk selection                    | Pending |
| FOLDER-13  | Bulk move/delete/tag/pin/star     | Pending |
| FOLDER-14  | Cross-drive move fallback         | Pending |
| FOLDER-15  | Hidden-name rename block          | Pending |

## Success Criteria

- [ ] Bulk move of 100 notes < 2 s.
- [ ] No data loss in chaos test: bulk move while watcher emits external changes.
- [ ] Inline rename keyboardable (Tab/Enter/Esc).
