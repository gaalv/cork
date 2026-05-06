# F12 — Folder Operations & Rename UX Design

## IPC additions

```ts
namespace folders {
  create(parent: string, name: string): Promise<{ path: string }>
  rename(oldPath: string, newName: string): Promise<{ path: string }>
  move(srcPath: string, destParent: string): Promise<{ path: string }>
  trash(path: string): Promise<void>
}
namespace notes {
  move(notePath: string, destFolder: string): Promise<{ path: string }>
  bulkMove(paths: string[], destFolder: string): Promise<{ moved: string[]; failed: { path: string; error: IpcError }[] }>
  bulkTrash(paths: string[]): Promise<{ trashed: string[]; failed: ... }>
  bulkSetFrontmatter(paths: string[], patch: Record<string, unknown>): Promise<...>  // for tag add/remove, pin, star
}
```

Events:
- `vault.folderChanged { path, kind: 'created'|'renamed'|'removed', source }`

## Components

```
src-tauri/src/vault/folders.rs   — FS ops, atomic where possible
src-tauri/src/vault/bulk.rs      — bulk transactions

src/features/folder-ops/
  ui/
    NewFolderDialog.tsx
    InlineRename.tsx              — generic input-on-row pattern
    BulkActionsBar.tsx
    FolderPickerDialog.tsx        — for "Move to…"
  hooks/
    useDragDropFolder.ts          — react-dnd or HTML5 wiring
    useBulkSelection.ts
  services/
    folderOps.ts
    bulkOps.ts
  state/selectionStore.ts         — selected note ids set
```

Updates required in F07 components:
- `FoldersDrawer / FolderNode` — context menu (Radix), drop zones, inline rename.
- `NoteCard / drawer rows` — draggable.

Updates required in F04:
- `TopBar` — title segment becomes click-to-rename.

## Drag-and-drop

Library: `@dnd-kit/core` (lightweight, accessible, pointer + keyboard).
- Sortable not needed; just draggables (notes, folders) + droppables (folders).
- Keyboard fallback via `useBulkSelection` + "Move to…" command in palette.

## Bulk operations transactionality

All bulk operations run on the Rust side wrapped in a single SQL transaction for the index AND a per-file FS try/recover loop. On any single failure, the file is reported in `failed[]`, but the rest continue. UI shows a summary toast.

## Inline rename pattern

```tsx
<InlineRename
  initial={folder.name}
  onCommit={(name) => folders.rename(folder.path, name)}
  validate={(name) => /^[^/\\:*?"<>|.]+/.test(name) || 'Invalid'}
/>
```

Used by FoldersDrawer (folder row) and TopBar (note title).

## Risks

- Drag-and-drop conflicts with text selection — use a small drag handle / threshold.
- Renaming folder with thousands of notes inside — F02 watcher emits many events; indexer must batch.
- Cross-feature ordering: folder rename must complete in FS BEFORE the index acts on individual file rename events. Watcher already ordered.
