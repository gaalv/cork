# F05 — Editor Specification

**Owner phase:** M2
**Depends on:** F02, F03, F09 (resolution; can stub initially)
**Status:** Verified

## Problem Statement

We need a developer-grade Markdown editor: monospaced editing with Markdown-aware syntax highlighting, code-block highlighting (Shiki), KaTeX math, Mermaid diagrams, GitHub-style task lists, wikilink autocomplete, and a real preview. Editing must feel instant (< 16 ms typing) and saving must round-trip through F02 atomically without losing user input.

## Goals

- [ ] CodeMirror 6 editor with custom Markdown extension.
- [ ] Toggleable preview pane (split right).
- [ ] Wikilink autocomplete (`[[`) backed by `indexStore.notes` (typeahead, max 8 items).
- [ ] Tag autocomplete (`#`) from `tags.list()`.
- [ ] GFM tables, task list checkboxes (clickable in preview).
- [ ] Code blocks rendered with Shiki (`vitesse-light` theme to match Layout C).
- [ ] KaTeX math (`$inline$` and `$$block$$`).
- [ ] Mermaid diagrams in fenced code blocks.
- [ ] Auto-save 500 ms after last keystroke (atomic via F02).
- [ ] Optimistic concurrency (uses `expected_mtime` from F02).

## Out of Scope

| Feature                          | Reason   |
| -------------------------------- | -------- |
| WYSIWYG / hybrid live preview    | v2       |
| Image paste upload               | v2 (per PROJECT.md) |
| Vim/Emacs keybindings            | v2       |
| AI features                      | v2 (AD-012) |

---

## User Stories

### P1: Edit + auto-save ⭐ MVP

1. WHEN the user opens a note THEN the system SHALL load body into the editor in < 100 ms.
2. WHEN the user types THEN cursor latency SHALL be < 16 ms p95.
3. WHEN the user pauses for 500 ms after typing THEN the system SHALL call `notes.save` with `expected_mtime` from the loaded note.
4. WHEN save succeeds THEN the editor's "saved at HH:MM:SS" indicator SHALL update; mtime in store updated.
5. WHEN save fails with `Conflict` THEN the editor SHALL pause auto-save, show a banner: "File changed externally. Reload? Or keep my changes?", with two buttons.
6. WHEN the user navigates away with unsaved local changes THEN the system SHALL flush a synchronous save first.

### P1: Markdown highlighting ⭐ MVP

1. WHEN the editor is open THEN headings, bold, italic, links, wikilinks, tags, fenced code, lists, and quotes SHALL be visually distinct.
2. WHEN the user is on a heading line THEN the line SHALL be slightly larger (variable font size per heading level).
3. WHEN the cursor enters/leaves a wikilink THEN the brackets SHALL show / hide ("concealed brackets" pattern).

### P1: Preview pane ⭐ MVP

1. WHEN the user clicks the "Preview" toggle (or presses ⌘.) THEN the preview pane SHALL appear to the right of the editor with synced scrolling.
2. WHEN preview is open THEN it SHALL render the current buffer (debounced 100 ms).
3. WHEN the user clicks a wikilink in preview THEN the system SHALL navigate to the resolved note (via F09; if unresolved, show a popover offering "Create note '<title>'").
4. WHEN preview renders code THEN Shiki SHALL highlight to the language given in the fence.
5. WHEN preview renders math THEN KaTeX SHALL render inline and block.
6. WHEN preview renders Mermaid THEN the diagram SHALL render via `mermaid` lib (lazy-loaded chunk).
7. WHEN preview renders task list `- [x]` items THEN clicking the checkbox SHALL toggle the source line and trigger save.

### P1: Wikilink autocomplete ⭐ MVP

1. WHEN the user types `[[` THEN a popover appears at the cursor with up to 8 note suggestions, sorted by recent.
2. WHEN the user types more characters THEN suggestions SHALL filter (fuzzy on title).
3. WHEN the user picks a suggestion THEN the editor SHALL insert `[[<title>]]` and close the popover.
4. WHEN no match exists and the user presses Enter THEN the literal text SHALL be inserted (so users can pre-create links).

### P2: Tag autocomplete

1. WHEN the user types `#` after whitespace or BOL THEN a popover lists existing tags (top 10 by count) filtered as user types.

### P2: Slash menu

1. WHEN the user types `/` at start of an empty line THEN a slash menu lists block templates: heading, todo, code block, math, callout, table.

### P3: Outline (already in F08; this story is about updates)

1. WHEN the buffer changes THEN the outline (in note-view meta panel) SHALL refresh within 200 ms.

---

## Edge Cases

- WHEN the file changed externally between load and save (via watcher) THEN the editor SHALL show the conflict banner before the user's next save attempt.
- WHEN auto-save is in flight and the user types more THEN the next save SHALL queue (one in-flight at a time).
- WHEN the file is > 1 MB THEN preview SHALL render without Mermaid/KaTeX (degraded mode) and show a hint.
- WHEN Shiki fails to load (offline first run) THEN code SHALL render as plain `<pre>`.

---

## Requirement Traceability

| ID         | AC                                  | Phase | Status  |
| ---------- | ----------------------------------- | ----- | ------- |
| EDITOR-01  | Open buffer fast                    | Tasks | Verified |
| EDITOR-02  | Typing latency                      | Tasks | Verified |
| EDITOR-03  | Auto-save 500ms                     | Tasks | Verified |
| EDITOR-04  | Save indicator                      | Tasks | Verified |
| EDITOR-05  | Conflict banner                     | Tasks | Verified |
| EDITOR-06  | Flush on navigate-away              | Tasks | Verified |
| EDITOR-07  | Md highlighting                     | Tasks | Verified |
| EDITOR-08  | Heading sizes                       | Tasks | Verified |
| EDITOR-09  | Wikilink concealed brackets         | Tasks | Verified |
| EDITOR-10  | Preview toggle                      | Tasks | Verified |
| EDITOR-11  | Preview debounced                   | Tasks | Verified |
| EDITOR-12  | Wikilink navigation in preview      | Tasks | Verified |
| EDITOR-13  | Shiki                               | Tasks | Verified |
| EDITOR-14  | KaTeX                               | Tasks | Verified |
| EDITOR-15  | Mermaid                             | Tasks | Verified |
| EDITOR-16  | Task list toggle                    | Tasks | Verified |
| EDITOR-17  | Wikilink autocomplete               | Tasks | Verified |
| EDITOR-18  | Tag autocomplete                    | Tasks | Verified |
| EDITOR-19  | Slash menu                          | Tasks | Verified |
| EDITOR-20  | Outline updates                     | Tasks | Verified |
| EDITOR-21  | External-change reconciliation      | Tasks | Verified |
| EDITOR-22  | Large-file degraded mode            | Tasks | Verified |

## Success Criteria

- [ ] Typing latency p95 < 16 ms on 5 k-line buffer (measured with Performance API).
- [ ] Preview update p95 < 80 ms after debounce.
- [ ] No data loss in chaos test: 100 saves under random external modifications → final state matches expectation.
- [ ] Bundle: editor chunk lazy-loaded; main bundle still < 500 kB gzipped.
