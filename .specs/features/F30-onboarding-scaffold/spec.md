# F30 — Onboarding scaffold (welcome notes)

## Overview

When Cork opens an empty vault (or one that has never seen our scaffold), it
should pre-populate a small, opinionated set of notes that demonstrate the
app's capabilities — like Linear/Obsidian/Notion onboarding examples. This
turns the first-launch experience from "blank canvas anxiety" into "I can
already see what this is for."

## Requirements

- **R1** When a vault is opened that has zero `.md` files at the root **and**
  has no `.cork/scaffold.json` marker, the backend writes a curated set of
  example notes and folders, then writes the marker so it never repeats.
- **R2** Scaffold contents (paths relative to vault root):
  - `Welcome.md` — landing note explaining Cork's main features (wikilinks,
    tags, daily notes, todos, calendar, sync). Contains live `[[wikilinks]]`,
    `#tags`, a checkbox list, and a code block.
  - `Daily/2026-05-08.md` — example daily note explaining the daily-note
    pattern.
  - `Projects/Cork Showcase.md` — multi-section example with headings, a
    Mermaid block, an image stub, and a backlinks-friendly mention of
    `[[Welcome]]`.
  - `Meetings/2026-05-07 Kickoff.md` — example meeting notes with attendees,
    agenda, action items, and `#meetings` tag.
  - `Cheatsheet.md` — compact reference of the markdown extensions Cork
    supports.
- **R3** The scaffold respects existing files: if any of the target paths
  already exist, that one is **skipped** (no overwrite). The marker is still
  written on completion.
- **R4** A new IPC command `vault.scaffoldIfNeeded` triggers this; called
  once after `notes_load_all` returns an empty list and no marker exists.
- **R5** The frontend toasts "Welcome to Cork — example notes added" when
  the scaffold runs.
- **R6** A few seed `.cork/todos.json` entries are added so the new
  OpenTodosCard isn't empty on first launch:
  - "Read the Welcome note" (open)
  - "Try the command palette (⌘K)" (open)
  - "Pin a note from its menu" (open)
- **R7** Scaffold is idempotent: re-running the IPC after the marker exists
  is a no-op.

## Out of scope

- Localization — content is in English (consistent with rest of UI strings).
- A "restore scaffold" button (deferred).
- Per-template customisation.

## Acceptance

- Opening a fresh vault produces the listed files and todos.
- Re-opening or restarting does not duplicate or overwrite files.
- All scaffold files render correctly in the editor (no markdown errors).
- The marker file `.cork/scaffold.json` is created and ignored by git
  (already covered by `.cork/cache/` ignore pattern adjacency — verify).
