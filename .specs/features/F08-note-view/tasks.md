# F08 — Note View Tasks

```
T01 → { T02[P], T03[P], T04[P], T05[P] } → T06 → T07 → T08
```

### T01: noteViewStore
**Where:** `src/features/note-view/state/noteViewStore.ts`
**Requirement:** NOTE-12
**Commit:** `feat(note-view): zustand store`

### T02: useOutline (worker) [P]
**Where:** `src/features/note-view/hooks/useOutline.ts`, `worker/outlineWorker.ts`
**Requirement:** NOTE-03, 04
**Commit:** `feat(note-view): outline derivation worker`

### T03: useBacklinks [P]
**What:** Calls `links.incoming(noteId)`, joins with note titles via `notes.byId`. Subscribes to `vault.fileChanged` for invalidation.
**Where:** `hooks/useBacklinks.ts`
**Requirement:** NOTE-06, 07
**Commit:** `feat(note-view): backlinks hook`

### T04: useScrollSpy [P]
**Where:** `hooks/useScrollSpy.ts` + tests
**Requirement:** NOTE-05
**Commit:** `feat(note-view): scroll spy hook`

### T05: AISuggestionCard stub [P]
**Where:** `ui/AISuggestionCard.tsx`
**Requirement:** NOTE-10
**Commit:** `feat(note-view): ai suggestion stub card`

### T06: Outline + BacklinksList + RecentsList + Footer
**Where:** `ui/{Outline,BacklinksList,RecentsList,NoteMetaFooter}.tsx` + tests
**Depends on:** T02, T03
**Requirement:** NOTE-03..08, 11
**Commit:** `feat(note-view): meta panel sections`

### T07: NoteMetaPanel + responsive collapse
**Where:** `ui/NoteMetaPanel.tsx`
**Requirement:** NOTE-02
**Commit:** `feat(note-view): meta panel container`

### T08: NoteView composition + ViewRouter wiring
**Where:** `ui/NoteView.tsx`, `src/features/shell/ui/ViewRouter.tsx`
**Requirement:** NOTE-01, 09, 12
**Done when:** Open note → editor + preview + meta panel all render with real data.
**Commit:** `feat(note-view): compose note view`
