# F40 — Note Status Specification

## Problem Statement

Cork covers the extremes of a note's lifecycle — Inbox (captured, unsorted) and archive (out of the way, expiring) — but has no middle state: "working on this", "paused", "finished but still relevant". Users fake it with tags (`#wip`), which are non-exclusive and carry no UI semantics. An Inkdrop-style status field fills the gap and completes the triage identity of the app.

## Goals

- [ ] A note can carry exactly one status — `active`, `on-hold`, or `done` — or none (default)
- [ ] Status is visible at a glance in the notes list and filterable from the sidebar
- [ ] Zero cost for non-users: notes without status look and behave exactly as today
- [ ] Status is plain frontmatter — portable, Obsidian-visible, synced via git (AD-004, AD-053 pattern)

## Out of Scope

| Feature                                   | Reason                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Kanban/board view                         | Cork is not a task manager (F25 Todos was deliberately removed)          |
| Due dates / reminders                     | Same reason                                                              |
| Custom user-defined statuses              | Fixed set keeps UI/queries simple; revisit if asked                      |
| "Done for N days → suggest archive" nudge | Nice pairing with archive retention, but adds nudge UI; deferred         |
| `dropped` status                          | Covered by archive — that's what "out of the flow" already means in Cork |

---

## User Stories

### P1: Set and see a status ⭐ MVP

**User Story**: As a user, I want to set a status on a note and see it in the list so I know each note's state at a glance.

**Acceptance Criteria**:

1. WHEN the user sets a status via the note context menu or Inspector → Properties THEN system SHALL write `status: <value>` to the note's frontmatter (optimistic update → persist → rollback on error, per CONVENTIONS)
2. WHEN a note has a status THEN its NotesList card SHALL show a compact status badge (color + label); no badge when unset
3. WHEN the user selects "None" THEN system SHALL remove the `status` key from frontmatter (not write `status: none`)
4. WHEN a note's frontmatter has an unknown status value (edited externally) THEN system SHALL treat it as unset (no badge, no crash)

**Independent Test**: Right-click note → Status → Active → badge appears; open the `.md` → `status: active` in frontmatter.

---

### P1: Filter by status ⭐ MVP

**User Story**: As a user, I want to filter the notes list by status so I can see everything I'm actively working on.

**Acceptance Criteria**:

1. WHEN the user clicks a status row in the sidebar (Active / On Hold / Done, with counts) THEN NotesList SHALL show only notes with that status
2. WHEN the index updates (external edit of frontmatter) THEN counts and filtered lists SHALL reconcile automatically (`index:updated`, same as pinned)

**Independent Test**: Set two notes Active → sidebar shows "Active 2" → click → list shows exactly those two.

---

### P2: Status from command palette

**User Story**: As a keyboard user, I want to set the open note's status from ⌘K.

**Acceptance Criteria**:

1. WHEN a note is open THEN palette SHALL offer "Set status: Active / On Hold / Done / None" entries acting on the open note
2. WHEN no note is open THEN the entries SHALL be hidden

---

## Edge Cases

- WHEN status is set on a dirty (unsaved) buffer THEN the mutation SHALL go through the same frontmatter path as pin toggling — no lost edits
- WHEN a note is archived THEN its status frontmatter is preserved untouched (archive is orthogonal)
- WHEN bulk-selecting notes THEN bulk status set MAY reuse `notes.bulkSetFrontmatter` (stretch, not required for MVP)

---

## Requirement Traceability

| Requirement ID | Story                                            | Phase | Status  |
| -------------- | ------------------------------------------------ | ----- | ------- |
| STAT-01        | P1: `status` frontmatter write/remove mutation   | Tasks | Pending |
| STAT-02        | P1: Status query from index (`notes.statuses`)   | Tasks | Pending |
| STAT-03        | P1: NotesList badge                              | Tasks | Pending |
| STAT-04        | P1: Sidebar filter rows + counts                 | Tasks | Pending |
| STAT-05        | P1: Context menu + Inspector Properties selector | Tasks | Pending |
| STAT-06        | P2: Palette entries                              | Tasks | Pending |
| STAT-07        | Edge: unknown values treated as unset            | Tasks | Pending |

**Coverage:** 7 total, 7 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Set status → badge + filter reflect it in < 1s without manual refresh
- [ ] A vault where no note has status renders pixel-identical to today
- [ ] Frontmatter round-trips cleanly through Obsidian (plain `status: active`)
