# F40 — Note Status Tasks

No automated tests (project decision). Verify = `pnpm typecheck && pnpm lint && cargo check` + manual UAT per task.

## Phase 1 — Data path

### F40-T01 — `notes.statuses` index query + IPC contract (STAT-02)

- **What:** Rust query returning all `(note_id, status)` pairs from the `frontmatter` table for key `status`; command registered in `index/mod.rs` + `lib.rs`; `NoteStatus` type + `notes.statuses` entry in `src/ipc/types.ts` / `src/ipc/IpcContract.ts` (same commit).
- **Where:** `src-tauri/src/index/query.rs`, `src-tauri/src/index/mod.rs`, `src-tauri/src/lib.rs`, `src/ipc/types.ts`, `src/ipc/IpcContract.ts`
- **Reuses:** `query::pinned` shape (query.rs:103)
- **Done when:** Notes with `status:` frontmatter come back; unknown values included raw (frontend narrows).
- **Commit:** `feat(status): notes.statuses index query`

### F40-T02 — indexStore statusById + setNoteStatus mutation (STAT-01, STAT-07)

- **What:** `statusById` map loaded with `pinnedIds` (vault open + `index:updated`), narrowing unknown values to unset; `setNoteStatus(noteId, status | null)` — optimistic → persist via the SAME frontmatter write path as `toggleNotePin` (null removes key) → rollback + toast on error.
- **Where:** `src/stores/indexStore.ts` (+ the service `toggleNotePin` delegates to, if separate)
- **Depends on:** F40-T01
- **Done when:** Setting/clearing status updates the `.md` frontmatter on disk; dirty open buffer keeps its unsaved body; external edit reconciles the map.
- **Commit:** `feat(status): status map and optimistic setNoteStatus mutation`

## Phase 2 — Surfaces

### F40-T03 [P] — NotesList badge + status filter branch (STAT-03)

- **What:** Dot+label chip on cards with status (theme tokens, no hex); `{ kind: "status"; status }` added to `SidebarFilter` union + NotesList filter switch.
- **Where:** `src/components/notes/NotesList.tsx`, `SidebarFilter` type home (`src/utils/triageHelpers.ts` or where it lives)
- **Depends on:** F40-T02
- **Commit:** `feat(status): notes list badge and status filtering`

### F40-T04 [P] — Sidebar Status group with counts (STAT-04)

- **What:** "Status" group (Active / On hold / Done rows + counts from `statusById`) below Pinned/Archived; entire group hidden when all counts are 0.
- **Where:** `src/components/sidebar/Sidebar.tsx`
- **Depends on:** F40-T02
- **Commit:** `feat(status): sidebar status filters`

### F40-T05 [P] — Context menu submenu + Inspector selector (STAT-05)

- **What:** "Status ▸" submenu in `NoteContextMenu` (between Pin and Archive, checkmark on current, None clears); status select row in Inspector `PropertiesSection` bound to the open note through `setNoteStatus`.
- **Where:** `src/components/notes/NoteContextMenu.tsx`, `src/components/notes/NotesList.tsx` (wiring), `src/components/editor/inspector/PropertiesSection.tsx`
- **Depends on:** F40-T02
- **Commit:** `feat(status): context menu and inspector status selector`

## Phase 3 — Polish + close-out

### F40-T06 — Palette entries + docs (STAT-06)

- **What:** "Set status: Active / On hold / Done / None" palette entries, visible only with an open note; ROADMAP F40 → COMPLETE; STATE.md quick-task row.
- **Where:** `src/components/modals/CommandPalette.tsx`, `.specs/project/ROADMAP.md`, `.specs/project/STATE.md`
- **Depends on:** F40-T02
- **Commit:** `feat(status): palette commands + docs close-out`

## Traceability

| Req     | Tasks |
| ------- | ----- |
| STAT-01 | T02   |
| STAT-02 | T01   |
| STAT-03 | T03   |
| STAT-04 | T04   |
| STAT-05 | T05   |
| STAT-06 | T06   |
| STAT-07 | T02   |
