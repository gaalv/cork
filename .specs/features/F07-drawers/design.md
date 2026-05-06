# F07 — Drawers Design

**Spec:** `.specs/features/F07-drawers/spec.md`

## Components

```
src/features/drawers/
  ui/
    SearchDrawer.tsx
    SearchResultRow.tsx
    FoldersDrawer.tsx
    FolderNode.tsx
    RecentDrawer.tsx
    StarredDrawer.tsx
    TagsDrawer.tsx
    TagNode.tsx
  hooks/
    useSearch.ts
    useFolderTree.ts
    useStarred.ts
    useTagTree.ts
  state/drawersStore.ts   — selected tag, expanded folders, recent searches
  services/
    fts.ts                 — escape + run search
    starService.ts         — toggle starred frontmatter
```

## FTS query (Rust)

```sql
SELECT n.id, n.title, n.path, n.folder,
       snippet(notes_fts, 2, '<mark>', '</mark>', '…', 16) AS snippet,
       bm25(notes_fts) AS score
  FROM notes_fts
  JOIN notes n ON n.id = notes_fts.id
 WHERE notes_fts MATCH ?
 ORDER BY score
 LIMIT 30;
```

`?` is the **escaped** user input. Escaping: split on whitespace, wrap each token in double quotes, prepend each with `^` for prefix? — actually use `<token>*` for prefix matches; reject suspicious operators by escaping.

## Folder tree

Built client-side from `vaultStore.notes` once per change. Function `buildFolderTree(notes) -> TreeNode[]`. Memoized.

## Tag tree

Build from `tags.list()`. Split each tag on `/`. Aggregate counts up parents (count includes children).

## Star service

`star.toggle(noteId)`:
1. `notes.read(path)` to get fm.
2. `fm.starred = !fm.starred`.
3. `notes.save({ ...fm })`.
Optimistic UI update via `editorStore` if buffer open.

## Recent searches

Persisted via `tauri-plugin-store` under `noxe.searchHistory` (max 10 unique).

## Risks

- FTS5 syntax exposure (R-006 in CONCERNS.md). Always escape; never pass raw input to MATCH.
- Folder tree O(n) rebuild on every change — debounce 100 ms.
