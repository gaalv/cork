# F06 — Home Tasks

```
T01 → T02 → { T03[P], T04[P], T05[P], T06[P] } → T07 → T08 → T09 → T10
```

### T01: useHomeSections hook
**What:** Hook returning `{ pinned, recents, tagsTop, allPage, loadMore, isLoading }`. Subscribes to `vault.fileChanged` to invalidate.
**Where:** `src/features/home/hooks/useHomeSections.ts` + tests with mocked stores
**Depends on:** F03
**Requirement:** HOME-03..06, 10
**Commit:** `feat(home): sections data hook`

### T02: Add `notes.allPaged` query to F03
**What:** Extend `index/query.rs` with `all_paged(offset, limit)` and IPC method. Update IpcContract.
**Where:** rust + ts
**Depends on:** F03
**Requirement:** HOME-06
**Commit:** `feat(index): paginated all-notes query`

### T03: NoteCard + Menu [P]
**Where:** `src/features/home/ui/{NoteCard,NoteCardMenu}.tsx` + tests
**Depends on:** F04
**Requirement:** HOME-07, 08
**Commit:** `feat(home): note card with context menu`

### T04: PinnedGrid + RecentsList [P]
**Where:** `src/features/home/ui/{PinnedGrid,RecentsList}.tsx`
**Depends on:** T01, T03
**Requirement:** HOME-03, 04
**Commit:** `feat(home): pinned and recents sections`

### T05: TagPills [P]
**What:** Renders top tags; clicking dispatches `shellStore.toggleDrawer('tags')` + sets `tagsStore.selected`.
**Where:** `src/features/home/ui/TagPills.tsx`
**Depends on:** T01
**Requirement:** HOME-05, 13
**Commit:** `feat(home): tag pills section`

### T06: AllNotesGrid [P]
**What:** IntersectionObserver-based pager.
**Where:** `src/features/home/ui/AllNotesGrid.tsx`
**Depends on:** T01, T03
**Requirement:** HOME-06
**Commit:** `feat(home): paginated all-notes grid`

### T07: HomeHero + Skeletons
**Where:** `src/features/home/ui/{HomeHero,Skeletons}.tsx`
**Depends on:** F04
**Requirement:** HOME-01, 02, 11, 12
**Commit:** `feat(home): hero and skeletons`

### T08: pinService + usePinToggle
**Where:** `src/features/home/services/pinService.ts`, `hooks/usePinToggle.ts`
**Depends on:** F02 notes.save
**Requirement:** HOME-09
**Done when:** Toggling updates frontmatter and refreshes Pinned.
**Commit:** `feat(home): pin/unpin service`

### T09: HomeView composition
**Where:** `src/features/home/ui/HomeView.tsx` (assembles all sections)
**Depends on:** T04..T08
**Done when:** Layout matches prototype Home; all sections data-driven.
**Commit:** `feat(home): compose home view`

### T10: E2E spec
**What:** Open vault → see real notes → pin a note → it appears in Pinned → unpin → it leaves.
**Where:** `tests/e2e/home/pin-flow.spec.ts`
**Depends on:** T09
**Commit:** `test(home): pin flow e2e`
