# F07 — Drawers Tasks

```
T01 → T02 → { T03[P], T04[P], T05[P], T06[P], T07[P] } → T08 → T09 → T10
```

### T01: Add `notes.search` IPC + Rust impl
**What:** Implement `index/search.rs` running the FTS5 query from design with token escaping. Expose as `notes_search` Tauri command + IpcContract.
**Where:** `src-tauri/src/index/search.rs`, `src/shared/ipc/IpcContract.ts`
**Depends on:** F03
**Requirement:** DRAWERS-01, 02, 12
**Done when:** Tests cover plain query, prefix, special chars, empty.
**Commit:** `feat(index): fts5 search command`

### T02: drawersStore
**Where:** `src/features/drawers/state/drawersStore.ts`
**Depends on:** F04
**Requirement:** DRAWERS-03, 09
**Done when:** Tests for selected tag, expanded folders, search history.
**Commit:** `feat(drawers): zustand store`

### T03: SearchDrawer + useSearch [P]
**Where:** `src/features/drawers/ui/SearchDrawer.tsx`, `hooks/useSearch.ts`
**Depends on:** T01, T02
**Requirement:** DRAWERS-01, 02, 03, 11
**Commit:** `feat(drawers): search drawer`

### T04: FoldersDrawer + tree builder [P]
**Where:** `src/features/drawers/ui/{FoldersDrawer,FolderNode}.tsx`, `hooks/useFolderTree.ts`
**Depends on:** F02 vaultStore
**Requirement:** DRAWERS-04, 05, 11
**Commit:** `feat(drawers): folders drawer`

### T05: RecentDrawer [P]
**Where:** `src/features/drawers/ui/RecentDrawer.tsx`
**Depends on:** F03 notes.recent
**Requirement:** DRAWERS-06
**Commit:** `feat(drawers): recent drawer with buckets`

### T06: StarredDrawer + starService [P]
**What:** New `notes.starred()` IPC query (frontmatter `starred = true`); UI lists them. starService toggles.
**Where:** `src/features/drawers/ui/StarredDrawer.tsx`, `services/starService.ts`, IPC additions
**Depends on:** F02, F03
**Requirement:** DRAWERS-07, 08, 11
**Commit:** `feat(drawers): starred drawer`

### T07: TagsDrawer + tag tree [P]
**Where:** `src/features/drawers/ui/{TagsDrawer,TagNode}.tsx`, `hooks/useTagTree.ts`
**Depends on:** F03 tags.list
**Requirement:** DRAWERS-09, 10
**Commit:** `feat(drawers): tags drawer`

### T08: Wire DrawerHost (from F04) to actual drawer components
**What:** Replace stub imports with real drawers.
**Where:** `src/features/shell/ui/DrawerHost.tsx`
**Depends on:** T03..T07
**Commit:** `feat(shell): mount real drawers`

### T09: A11y pass
**What:** Each drawer has `role="region"` + `aria-label`. Trees use `role="tree"/"treeitem"`. Keyboard nav (arrow keys) for folder/tag trees.
**Where:** affected components
**Depends on:** T08
**Done when:** axe-core reports no violations.
**Commit:** `feat(drawers): a11y trees + labels`

### T10: E2E search-flow
**Where:** `tests/e2e/drawers/search.spec.ts`
**Depends on:** T08
**Done when:** Open drawer → type "react" → click result → navigate.
**Commit:** `test(drawers): e2e search`
