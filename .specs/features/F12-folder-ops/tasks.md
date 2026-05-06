# F12 — Folder Operations & Rename UX Tasks

```
T01 → T02 → T03 → { T04[P], T05[P] } → T06 → T07 → T08 → { T09[P], T10[P], T11[P] } → T12 → T13
```

### T01: IPC additions
**Where:** `src/shared/ipc/IpcContract.ts` + types
**Depends on:** F07 done
**Requirement:** all
**Commit:** `feat(ipc): folder + bulk operations`

### T02: Rust folders.rs
**What:** create / rename / move / trash with cycle detection, conflict detection, cross-drive fallback. Emits `vault.folderChanged`.
**Where:** `src-tauri/src/vault/folders.rs` + tests
**Depends on:** T01
**Requirement:** FOLDER-01..07, 14, 15
**Done when:** ≥ 8 tests cover happy/conflict/cycle/cross-drive/hidden.
**Commit:** `feat(vault): folder operations`

### T03: Rust bulk.rs
**What:** `notes.move`, `notes.bulkMove`, `notes.bulkTrash`, `notes.bulkSetFrontmatter`. Each runs per-file with try/recover, returns `{ ok[], failed[] }`.
**Where:** `src-tauri/src/vault/bulk.rs` + tests
**Depends on:** T01
**Requirement:** FOLDER-08, 09, 13
**Commit:** `feat(vault): bulk note operations`

### T04: TS folderOps service [P]
**Where:** `src/features/folder-ops/services/folderOps.ts`
**Depends on:** T02
**Commit:** `feat(folder-ops): ts service for folders`

### T05: TS bulkOps service [P]
**Where:** `src/features/folder-ops/services/bulkOps.ts`
**Depends on:** T03
**Commit:** `feat(folder-ops): ts service for bulk`

### T06: InlineRename component
**Where:** `src/features/folder-ops/ui/InlineRename.tsx` + tests
**Requirement:** FOLDER-02, FOLDER-10
**Done when:** Tests for commit/cancel/validate.
**Commit:** `feat(folder-ops): inline rename component`

### T07: NewFolderDialog + FolderPickerDialog
**Where:** `src/features/folder-ops/ui/{NewFolderDialog,FolderPickerDialog}.tsx`
**Requirement:** FOLDER-01, FOLDER-13
**Commit:** `feat(folder-ops): folder dialogs`

### T08: Wire FoldersDrawer context menu + inline rename + new folder
**What:** Update `src/features/drawers/ui/FoldersDrawer.tsx` and `FolderNode.tsx` with Radix context menu (New, Rename, Move, Trash) + inline edit + new folder action at root.
**Where:** drawers files
**Depends on:** T04, T06, T07
**Requirement:** FOLDER-01, 02, 06, 07
**Commit:** `feat(drawers): folder context menu + inline rename`

### T09: useDragDropFolder hook + drop zones [P]
**What:** dnd-kit integration: notes draggable, folders droppable. Visual highlight on hover. Keyboard alt path triggers FolderPickerDialog.
**Where:** `src/features/folder-ops/hooks/useDragDropFolder.ts`, FoldersDrawer + NoteCard updates
**Depends on:** T04, T05
**Requirement:** FOLDER-04, FOLDER-08
**Commit:** `feat(folder-ops): drag-and-drop folders/notes`

### T10: TopBar inline rename for note title [P]
**What:** Replace static title in TopBar with `InlineRename` for the active note. On commit calls `notes.rename`.
**Where:** `src/features/shell/ui/TopBar.tsx`
**Depends on:** T06
**Requirement:** FOLDER-10, FOLDER-11
**Commit:** `feat(shell): inline rename in topbar`

### T11: useBulkSelection + BulkActionsBar [P]
**What:** Selection store + Shift/⌘-click handler attach + floating bottom bar with bulk actions.
**Where:** `src/features/folder-ops/{hooks/useBulkSelection.ts,state/selectionStore.ts,ui/BulkActionsBar.tsx}` + integration in AllNotesGrid + RecentDrawer
**Depends on:** T05
**Requirement:** FOLDER-12, FOLDER-13
**Commit:** `feat(folder-ops): bulk selection`

### T12: Auto-close currently-open deleted note
**What:** subscribe to `vault.fileChanged kind=removed`; if matches `editorStore.activeNoteId` → navigate Home and clear buffer.
**Where:** `src/features/editor/hooks/useExternalReconciler.ts` (extend)
**Requirement:** edge case
**Commit:** `fix(editor): handle deletion of open note`

### T13: E2E folder ops + bulk move
**Where:** `tests/e2e/folder-ops/{folder-rename.spec.ts,bulk-move.spec.ts}`
**Depends on:** T08, T09, T11
**Done when:** Green CI for both.
**Commit:** `test(folder-ops): e2e folder + bulk`
