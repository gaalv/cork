# F29 — Home polish (match prototype `LayoutMinimalCommand` Home)

## Overview

The current Home (after F25/F-recent refactor) is functional but visually
heavier than the prototype's `LayoutMinimalCommand` Home. The user wants:

- Hero with date, greeting, vault stats, and a "today's note" CTA.
- Smaller, denser cards with title + excerpt + tag pills + relative date.
- Tag pills section with counts (clickable).
- A compact 2-column "All notes" grid (when expanded).

## Requirements

- **R1** Hero: weekday + date label, greeting, "N notes · last edit Xm ago",
  "Open today's note →" pill button.
- **R2** Pinned section: 3-col grid of `NoteCard` (title, excerpt 3 lines,
  tag pills, mtime).
- **R3** Recents: keep current list style.
- **R4** Tags: pill row showing `#name` + count; clicking opens the Tags
  drawer (focus mode) or sets the NavPane selection (triage mode — no-op for
  this feature; depends on F28).
- **R5** All notes (when expanded via the "Browse all notes →" toggle from
  F26 todos refactor): switch from the existing `AllNotesGrid` 1-col layout
  to a 2-col compact `NoteCard`.
- **R6** Reuse the existing pinned/excerpt/flag enrichment from
  `useHomeSections` — no new IPC.

## Out of scope

- Theming changes.
- Drag-to-reorder Home sections.

## Acceptance

- Visual parity with prototype's `LayoutMinimalCommand` Home (tested by
  snapshot/inspection).
- Tests for new card variant and Hero variants pass.
