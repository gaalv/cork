# F06 — Home Specification

**Owner phase:** M3
**Depends on:** F03 (queries), F04 (router)
**Status:** Draft

## Problem Statement

The Home view is the user's landing page. It must answer "what should I look at?" instantly with: a hero greeting, Pinned, Recents, By Tag, and All Notes (browse). The migrated mock from F01 must become real, query-backed, and performant.

## Goals

- [ ] Hero with greeting + quick actions (New Note, ⌘K, Open Vault).
- [ ] Pinned section (notes with `pinned: true` in frontmatter), max 6 cards.
- [ ] Recents (top 8 by mtime).
- [ ] By Tag section: top 6 tags with note counts; clicking a tag opens the Tags drawer (F07).
- [ ] All Notes (paginated grid, page size 30, infinite scroll).
- [ ] Empty states for each section.
- [ ] Pin/unpin from a note's context menu (writes frontmatter).

## Out of Scope

| Feature                | Reason  |
| ---------------------- | ------- |
| Drag-reorder pins      | v2      |
| Custom dashboards      | v2      |
| Stats / activity graph | v2      |

---

## User Stories

### P1: Home loads fast ⭐ MVP

1. WHEN the user navigates to Home THEN the view SHALL render within 100 ms of `index.ready`.
2. WHEN data is loading THEN skeleton placeholders SHALL appear (not spinners).

### P1: Sections render real data ⭐ MVP

1. WHEN Home renders THEN Pinned SHALL show notes with `frontmatter.pinned === true`, max 6, sorted by `mtime DESC`.
2. WHEN Home renders THEN Recents SHALL show top 8 notes by `mtime DESC`.
3. WHEN Home renders THEN By Tag SHALL show top 6 tags by count.
4. WHEN Home renders THEN All Notes SHALL show first 30 notes (mtime DESC) and load 30 more on scroll.

### P1: Card actions ⭐ MVP

1. WHEN the user clicks a card THEN the system SHALL navigate to that note.
2. WHEN the user right-clicks (or "⋯") a card THEN a menu SHALL show: Open, Pin/Unpin, Star/Unstar, Reveal in Folders, Copy Path, Delete.
3. WHEN Pin/Unpin is chosen THEN the system SHALL update frontmatter via `notes.save` and refresh the section.

### P2: Live updates

1. WHEN `vault.fileChanged` arrives THEN affected sections SHALL re-query within 200 ms.

### P3: Customizable greeting

1. WHEN time of day is morning/afternoon/evening THEN hero greeting text SHALL change accordingly.

---

## Edge Cases

- WHEN there are 0 notes THEN show a single CTA: "Create your first note" (⌘N).
- WHEN there are 0 tags THEN hide the By Tag section entirely.
- WHEN All Notes has fewer than 30 items THEN don't show the "Load more" sentinel.

## Requirement Traceability

| ID      | AC                       | Phase | Status  |
| ------- | ------------------------ | ----- | ------- |
| HOME-01 | Render < 100 ms          | Tasks | Pending |
| HOME-02 | Skeletons                | Tasks | Pending |
| HOME-03 | Pinned section           | Tasks | Pending |
| HOME-04 | Recents section          | Tasks | Pending |
| HOME-05 | By Tag section           | Tasks | Pending |
| HOME-06 | All Notes paginated      | Tasks | Pending |
| HOME-07 | Card click → note view   | Tasks | Pending |
| HOME-08 | Card context menu        | Tasks | Pending |
| HOME-09 | Pin/unpin via frontmatter | Tasks | Pending |
| HOME-10 | Live updates             | Tasks | Pending |
| HOME-11 | Greeting variants        | Tasks | Pending |
| HOME-12 | Empty vault state        | Tasks | Pending |
| HOME-13 | Empty tags state         | Tasks | Pending |

## Success Criteria

- [ ] Home cold render: < 100 ms after `index.ready`.
- [ ] Scroll to "All Notes" + load more remains 60 fps on 1 k vault.
- [ ] All sections respond to file changes in < 200 ms.
