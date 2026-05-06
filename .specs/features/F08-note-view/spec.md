# F08 — Note View Specification

**Owner phase:** M3
**Depends on:** F02, F03, F04, F05
**Status:** Draft

## Problem Statement

The Note view is where the user reads/edits a single note. It composes the editor (F05) with a right-side meta panel (Outline, Backlinks, Recents) and a top breadcrumb. It must feel responsive and link the user back to Home or related notes effortlessly. Includes the AI Suggestion stub card (deferred real implementation per AD-012).

## Goals

- [ ] Three-column note layout: rail (shell) | editor + preview (F05) | right meta panel.
- [ ] Right panel: Outline, Backlinks, Recents, AI Suggestion (stub).
- [ ] Breadcrumb in TopBar already (F04); the note view subscribes to active note.
- [ ] Navigation between linked notes maintains scroll position.

## Out of Scope

| Feature                | Reason  |
| ---------------------- | ------- |
| Real AI               | AD-012 (deferred) |
| Tabs / multiple open notes | v2  |
| Split editor          | v2      |

---

## User Stories

### P1: Note layout ⭐ MVP

1. WHEN user opens a note THEN editor + preview + right panel SHALL render together.
2. WHEN viewport < 1024 px THEN right panel SHALL collapse to a togglable button.

### P1: Outline ⭐ MVP

1. WHEN buffer changes THEN Outline SHALL refresh in < 200 ms.
2. WHEN user clicks an outline heading THEN editor SHALL scroll to that line.
3. WHEN heading is currently in viewport THEN Outline SHALL highlight it.

### P1: Backlinks ⭐ MVP

1. WHEN note loads THEN Backlinks panel SHALL show all notes linking to this one (via `links.incoming(noteId)`).
2. WHEN user clicks a backlink THEN navigate to that note.
3. WHEN none exist THEN show empty state.

### P1: Recents (panel) ⭐ MVP

1. WHEN note view is active THEN right panel SHALL show 5 most recently opened notes (excluding current).
2. WHEN user clicks one THEN navigate.

### P1: Star toggle in TopBar ⭐ MVP

(Already specified in F04; this story confirms the wiring.)
1. WHEN user clicks star icon THEN starService toggles frontmatter and breadcrumb icon updates.

### P2: AI Suggestion stub

1. WHEN note view loads THEN a card "AI Suggestions (coming soon)" SHALL render with placeholder content.
2. WHEN user clicks the card THEN nothing happens beyond a tooltip (v1).

### P2: Note metadata footer

1. WHEN at end of editor scroll THEN show created/updated dates + word count.

---

## Edge Cases

- WHEN note has no headings THEN Outline shows "No headings".
- WHEN note has 100+ backlinks THEN panel virtualizes after 30 visible.
- WHEN navigating between notes quickly THEN scroll positions are preserved per noteId in `editorStore`.

## Requirement Traceability

| ID       | AC                       | Status  |
| -------- | ------------------------ | ------- |
| NOTE-01  | Three-column layout      | Verified |
| NOTE-02  | Responsive collapse      | Verified |
| NOTE-03  | Outline refresh < 200ms  | Verified |
| NOTE-04  | Outline click → scroll   | Verified |
| NOTE-05  | Outline active highlight | Verified |
| NOTE-06  | Backlinks list           | Verified |
| NOTE-07  | Backlink click → nav     | Verified |
| NOTE-08  | Recents (panel)          | Verified |
| NOTE-09  | Star toggle              | Verified |
| NOTE-10  | AI stub card             | Verified |
| NOTE-11  | Metadata footer          | Verified |
| NOTE-12  | Scroll position preserved | Verified |

## Success Criteria

- [ ] Switching between notes < 80 ms first paint.
- [ ] Backlinks loads < 50 ms for 100 incoming.
- [ ] Outline scroll-spy updates without jank.
