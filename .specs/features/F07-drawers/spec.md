# F07 — Drawers Specification

**Owner phase:** M3
**Depends on:** F03, F04
**Status:** Complete

## Problem Statement

The rail drawers (Search, Folders, Recent, Starred, Tags) are currently mock shells. We need each drawer fully functional, with real query-backed lists, FTS5 search, folder tree, starred persistence, and tag hierarchy.

## Goals

- [ ] **SearchDrawer** — FTS5 across title + body, highlight matches, result list with snippet, debounce 120 ms.
- [ ] **FoldersDrawer** — collapsible folder tree, count per folder, click → filter All Notes / open first note.
- [ ] **RecentDrawer** — top 50 by mtime; "today / yesterday / this week" buckets.
- [ ] **StarredDrawer** — notes with `frontmatter.starred === true`. Star toggled from note view.
- [ ] **TagsDrawer** — alphabetical tag tree (slash-separated → nested), counts.

## Out of scope

- Search filters (date, folder, tag combinations) — v2.
- Saved searches — v2.

---

## User Stories

### P1: Search ⭐ MVP

1. WHEN user types in SearchDrawer (≥ 2 chars) THEN system SHALL run `notes.search(query)` (FTS5) with 120 ms debounce.
2. WHEN results return THEN each row SHALL show title (highlighted) + 1-line snippet + folder.
3. WHEN user clicks a result THEN navigate to note + (optional) scroll/highlight match.
4. WHEN query empty THEN show "Recent searches" (last 10, persisted).

### P1: Folders ⭐ MVP

1. WHEN drawer opens THEN system SHALL render the folder tree (root → leaves) with counts.
2. WHEN user clicks a folder THEN list of notes in that folder SHALL appear inline (collapsible).
3. WHEN user clicks a note THEN navigate.
4. WHEN folder is empty THEN show "(no notes)".

### P1: Recent ⭐ MVP

1. WHEN drawer opens THEN show top 50 by mtime, bucketed by Today / Yesterday / This week / Earlier.
2. WHEN file changes THEN list refreshes.

### P1: Starred ⭐ MVP

1. WHEN drawer opens THEN show notes with `starred: true` frontmatter.
2. WHEN user toggles star (from note view F08) THEN list updates.
3. WHEN no starred notes THEN show empty state with "Star a note to see it here".

### P1: Tags ⭐ MVP

1. WHEN drawer opens THEN show alphabetical list of unique tag prefixes.
2. WHEN user clicks a parent tag (e.g., `dev`) THEN children expand (`dev/rust`, `dev/ts`).
3. WHEN user clicks a leaf THEN navigate to a Tag view (or update Home's By Tag section — pick one in design).
4. Counts shown next to each.

---

## Edge Cases

- Search with special characters (e.g., `c++`) — escape FTS5 syntax to avoid errors.
- Folder names with `/` (only on UNIX) — treat as nested per usual behavior.
- Tags with deep nesting (`a/b/c/d`) — render to depth 4; deeper collapsed.

## Requirement Traceability

| ID         | AC                  | Status  |
| ---------- | ------------------- | ------- |
| DRAWERS-01 | Search debounce     | Verified |
| DRAWERS-02 | Search highlights   | Verified |
| DRAWERS-03 | Search recent       | Verified |
| DRAWERS-04 | Folders tree        | Verified |
| DRAWERS-05 | Folder counts       | Verified |
| DRAWERS-06 | Recent buckets      | Verified |
| DRAWERS-07 | Starred list        | Verified |
| DRAWERS-08 | Star toggle reflects | Verified |
| DRAWERS-09 | Tag hierarchy       | Verified |
| DRAWERS-10 | Tag counts          | Verified |
| DRAWERS-11 | Empty states        | Verified |
| DRAWERS-12 | FTS5 escaping       | Verified |

## Success Criteria

- [ ] Search returns < 50 ms p95 on 1 k vault.
- [ ] Folder tree renders < 50 ms for 200 folders.
- [ ] All drawers open in < 50 ms.
