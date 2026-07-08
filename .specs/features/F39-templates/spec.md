# F39 — Note Templates Specification

## Problem Statement

Recurring note shapes (meetings, project briefs, bug reports, decisions) are retyped from scratch every time. Cork has no way to start a note from a predefined structure, and the `templates` settings section id plus `dailyTemplatePath` vault setting exist as dormant stubs. Templates close the gap between "quick capture" and "structured note" without adding any new storage format.

## Goals

- [ ] Create a new note from a template in ≤ 3 interactions (⌘K → pick template → note opens in edit mode)
- [ ] Insert a template body at the cursor of an existing note
- [ ] Ship 4 default templates that users can freely edit or delete
- [ ] Users can create/manage templates as plain `.md` files — zero new file formats (AD-004 preserved)

## Out of Scope

| Feature                                                            | Reason                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Custom date format tokens (`{{date:YYYY-MM}}`)                     | MVP ships fixed tokens; formats deferred until asked for         |
| Templater-style scripting / JS eval                                | Massive scope + security surface; not v1                         |
| Per-folder default template ("new note in Meetings/ uses Meeting") | Needs folder-settings UI; deferred                               |
| Daily-note template wiring (`dailyTemplatePath`)                   | Dormant setting stays dormant; revisit with Daily Notes revival  |
| Template variables prompt/form (`{{var:name}}`)                    | Deferred; unknown tokens pass through untouched                  |
| Hiding Templates/ from NotesList/search                            | Templates are normal notes by design (portable, editable in-app) |

---

## User Stories

### P1: New note from template ⭐ MVP

**User Story**: As a note-taker, I want to create a new note from a template so that recurring note shapes start pre-structured.

**Why P1**: This is the core value of the feature; everything else supports it.

**Acceptance Criteria**:

1. WHEN the user runs "New note from template" from the command palette THEN system SHALL show a picker listing every `.md` file in the templates folder (name = filename stem)
2. WHEN the user picks a template THEN system SHALL create a note in the active folder target (Inbox default) with the template's frontmatter (merged with `created`) and body, variables expanded, and open it in edit mode
3. WHEN the template contains `{{cursor}}` THEN system SHALL strip the marker and place the caret at that position when the editor opens
4. WHEN the templates folder is empty or missing THEN the picker SHALL show an empty state with a "Create template" action

**Independent Test**: ⌘K → "New note from template" → pick "Meeting" → note opens in edit mode with headings filled and today's date.

---

### P1: Default templates seeded ⭐ MVP

**User Story**: As a new user, I want ready-made templates so the feature is useful before I author anything.

**Why P1**: An empty picker on first use makes the feature feel broken.

**Acceptance Criteria**:

1. WHEN a vault is scaffolded (fresh or version refresh) THEN system SHALL seed `Templates/Meeting.md`, `Templates/Project.md`, `Templates/Bug Report.md`, `Templates/Decision.md` **only if each file does not already exist**
2. WHEN a user edits or deletes a seeded template THEN a later scaffold refresh SHALL NOT overwrite or resurrect it (create-if-missing, never overwrite — stricter than the Welcome.md refresh rule)

**Independent Test**: Open a fresh vault → `Templates/` contains 4 files; edit one, bump scaffold version, reopen → edit preserved.

---

### P2: Insert template at cursor

**User Story**: As a writer, I want to insert a template's body into the note I'm editing so I can add structured sections (e.g., another meeting block) without creating a new note.

**Why P2**: Same picker and renderer as P1; small increment approved in discuss.

**Acceptance Criteria**:

1. WHEN the user runs "Insert template" from the command palette with a note open in edit mode THEN system SHALL show the same picker and insert the rendered **body only** (template frontmatter ignored) at the cursor
2. WHEN the inserted body contained `{{cursor}}` THEN system SHALL place the caret at that position after insertion
3. WHEN no note is open or the editor is in preview THEN the palette entry SHALL be disabled or no-op with a toast explaining why

**Independent Test**: Open a note → ⌘K → "Insert template" → pick "Meeting" → body appears at cursor with `{{date}}` expanded.

---

### P2: Templates settings section

**User Story**: As a user, I want a Settings → Templates section so I can change the templates folder and manage templates.

**Why P2**: The section id already exists in `settingsUiStore`; discoverability and folder config need a home.

**Acceptance Criteria**:

1. WHEN the user opens Settings → Templates THEN system SHALL show the per-vault templates folder setting (default `Templates`) and the list of current templates
2. WHEN the user clicks "New template" THEN system SHALL create an untitled `.md` in the templates folder and open it in the editor
3. WHEN the user changes the templates folder THEN pickers SHALL immediately list from the new folder

---

## Variable tokens (MVP set)

| Token           | Expands to                                                                       |
| --------------- | -------------------------------------------------------------------------------- |
| `{{title}}`     | Note title (new-note flow: created note's title; insert flow: open note's title) |
| `{{date}}`      | Local date `YYYY-MM-DD`                                                          |
| `{{time}}`      | Local time `HH:mm`                                                               |
| `{{datetime}}`  | Local ISO-8601 with offset                                                       |
| `{{cursor}}`    | Stripped; caret lands here (first occurrence; extras stripped)                   |
| unknown `{{x}}` | Left untouched                                                                   |

Expansion applies to frontmatter values and body. Single renderer lives in Rust (see design).

---

## Edge Cases

- WHEN the picked template file was deleted between list and render THEN system SHALL toast an error and keep the picker usable
- WHEN a template has no frontmatter THEN new-note creation SHALL still add `created`
- WHEN two templates share a filename stem in nested subfolders of Templates/ THEN picker SHALL show the relative path to disambiguate
- WHEN the created note's title collides THEN system SHALL reuse the existing `unique_note_path` suffixing
- WHEN the templates folder setting points to a non-existent folder THEN list SHALL return empty (no error, no auto-create until "New template")

---

## Requirement Traceability

| Requirement ID | Story                                             | Phase | Status  |
| -------------- | ------------------------------------------------- | ----- | ------- |
| TMPL-01        | P1: New note from template — picker + palette     | Tasks | Pending |
| TMPL-02        | P1: New note from template — create + open flow   | Tasks | Pending |
| TMPL-03        | P1: Variable rendering (Rust, single renderer)    | Tasks | Pending |
| TMPL-04        | P1: `{{cursor}}` caret placement                  | Tasks | Pending |
| TMPL-05        | P1: Default templates seeded create-if-missing    | Tasks | Pending |
| TMPL-06        | P2: Insert template at cursor                     | Tasks | Pending |
| TMPL-07        | P2: Settings → Templates section + folder setting | Tasks | Pending |
| TMPL-08        | Edge: missing template / empty folder handling    | Tasks | Pending |

**Coverage:** 8 total, 8 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] New note from template in ≤ 3 interactions, opens in edit mode with caret at `{{cursor}}`
- [ ] Fresh vault shows 4 templates in the picker with zero user setup
- [ ] Vault remains pure `.md` — Obsidian can open and use the same Templates/ folder
