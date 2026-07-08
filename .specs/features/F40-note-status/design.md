# F40 — Note Status Design

## Principle

Status clones the **pinned** architecture end-to-end (AD-053): frontmatter key → indexed in the `frontmatter` table by the existing worker → queried into an indexStore map → client-side filtering in NotesList → mutation via the same optimistic frontmatter write path as `toggleNotePin`. No new persistence mechanism, no new table, no schema migration.

## Data model

- Frontmatter key `status`, values `"active" | "on-hold" | "done"`. Absent = unset. "None" removes the key.
- TS type: `export type NoteStatus = "active" | "on-hold" | "done"` in `src/ipc/types.ts`. Unknown values narrow to `undefined` at the store boundary (STAT-07).
- The index worker already re-indexes frontmatter on every save/external change (`worker.rs:263` — added for pinned); status inherits that for free.

## IPC (same commit as Rust handler)

```ts
"notes.statuses": {
  input: {};
  output: { statuses: { noteId: string; status: string }[] };
}
```

Rust: `index/query.rs` — `SELECT note_id, value FROM frontmatter WHERE key = 'status'` (mirror of `pinned()` at query.rs:103, but returning pairs, not filtered by value). Register in `index/mod.rs` + `lib.rs`.

## Frontend

- **indexStore**: `statusById: Map<string, NoteStatus>` loaded alongside `pinnedIds` on vault open and every `index:updated`. New mutation `setNoteStatus(noteId, status: NoteStatus | null)`:
  optimistic map update → persist via the same frontmatter-write path `toggleNotePin` uses → rollback + toast on error. `null` deletes the key.
- **NotesList badge** (STAT-03): small dot+label chip on the card metadata row. Colors via existing theme tokens (no hardcoded hex): active = accent/green, on-hold = amber/muted, done = muted. Label copy: "Active", "On hold", "Done".
- **Sidebar** (STAT-04): a "Status" group below the existing Pinned/Archived rows — three rows with counts derived from `statusById` (hide the whole group when all counts are 0, keeping the zero-cost promise). Extend the `SidebarFilter` union with `{ kind: "status"; status: NoteStatus }`; NotesList filter switch gains the matching branch (client-side, like pinned).
- **NoteContextMenu** (STAT-05): "Status ▸" submenu (Active / On hold / Done / None), checkmark on current. Sits between Pin and Archive.
- **Inspector → PropertiesSection** (STAT-05): status select row reading `frontmatter.status` from `editorStore`, writing through `setNoteStatus` (keeps single mutation path even when the buffer is open).
- **CommandPalette** (STAT-06): "Set status: …" entries visible only when `view.kind === "note"`.

## Interaction with archive

None by design: archiving preserves `status` frontmatter; restore brings it back. The "done → suggest archive" nudge stays out of scope (spec table).

## Risks / notes

- The dirty-buffer case is the one real trap: writing frontmatter to disk while the editor holds unsaved body text must not clobber either side. `toggleNotePin` already solved this — status MUST reuse that exact code path rather than a parallel writer. If the Inspector selector writes through `editorStore` frontmatter + normal save instead, pick whichever of the two paths pin uses for the open note and stay consistent.
- Sidebar noise: the collapsible/hidden-when-empty "Status" group is what keeps non-users unaffected. Don't ship it always-visible.
- Sort order: no status-based sorting in MVP; filter only.
