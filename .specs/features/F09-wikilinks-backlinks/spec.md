# F09 — Wikilinks & Backlinks Specification

**Owner phase:** M4
**Depends on:** F03 (links table), F05 (autocomplete UI), F08 (backlinks panel)
**Status:** Draft

## Problem Statement

Wikilinks `[[Note Title]]` are core to the experience. They must:
1. Be parsed once by the index (Rust) and consistently by the preview (JS) — parity already enforced (F03).
2. Resolve to a `note_id` via a deterministic algorithm (filename, alias, fallback).
3. Be clickable in preview to navigate, with a popover when ambiguous.
4. Allow creating a missing note on click ("create on click").
5. Power Backlinks (already wired in F08) once `links.target_id` is populated.

## Goals

- [ ] Resolution algorithm: 1) exact filename match, 2) exact title match, 3) frontmatter alias match, 4) most-recently-edited fallback, 5) unresolved.
- [ ] Resolver runs after every index change for affected links (incremental).
- [ ] Click on a resolved wikilink → navigate.
- [ ] Click on an unresolved wikilink → popover with "Create note '<target>'" + "Choose existing".
- [ ] Rename a note → all `target_text` matching old title rewrite their `target_id`; in source files, replace literal `[[old]]` with `[[new]]` (configurable: default ON).
- [ ] Backlinks panel uses `links.incoming` (already in F08), now with real data.

## Out of Scope

| Feature                             | Reason  |
| ----------------------------------- | ------- |
| Block / heading refs (`[[note#h]]`) | v2      |
| Embed transclusion (`![[note]]`)    | v2      |
| Graph view                          | v2 (PROJECT.md) |

---

## User Stories

### P1: Resolution ⭐ MVP

1. WHEN the indexer parses a note's body THEN each `[[target]]` SHALL be persisted with `target_text = target` and `target_id = resolve(target)`.
2. WHEN multiple notes match (collision) THEN the resolver SHALL pick the most recently modified and store its id; the link SHALL also record `ambiguous = true` (new column or boolean) — see design.
3. WHEN no match THEN `target_id = null`.

### P1: Click to navigate ⭐ MVP

1. WHEN preview renders `[[target]]` and `target_id` exists THEN it SHALL render as a clickable link (`<a class="wikilink">`).
2. WHEN clicked THEN `shellStore.navigate({ kind: 'note', id: target_id })`.
3. WHEN `target_id` is null THEN render with `class="wikilink unresolved"` (visually distinct).

### P1: Create on click (unresolved) ⭐ MVP

1. WHEN user clicks an unresolved wikilink THEN a popover SHALL appear with:
   - "Create '<target>.md' here" (creates in current note's folder).
   - "Create '<target>.md' at root".
   - "Pick existing note…" (opens palette pre-filled with target).
2. WHEN user picks "Create…" THEN `notes.create(folder, target)` is called, the new note opens, and the source file is updated to point to it (next index pass picks up resolution automatically).

### P1: Rename propagation ⭐ MVP

1. WHEN a note is renamed (`notes.rename`) THEN the system SHALL search source bodies via the index for `[[oldTitle]]` and `[[oldTitle|alias]]` occurrences and replace with the new title (preserving alias) — atomic via F02 saves.
2. WHEN there are 0 occurrences THEN no rewrites happen.
3. WHEN the user disables "auto-rewrite links on rename" in settings THEN this step SHALL be skipped (only the `target_id` is updated).

### P1: Backlinks accuracy ⭐ MVP

1. WHEN F08's panel queries `links.incoming(noteId)` THEN result SHALL only include links whose `target_id` resolves to that note (unresolved links excluded).

### P2: Wikilink hover preview

1. WHEN hovering a resolved wikilink THEN show a small card with target's title + first 200 chars of body.

### P2: Aliases

1. WHEN frontmatter has `aliases: [...]` THEN resolution SHALL also match against aliases.
2. WHEN a wikilink uses `[[Title|alias]]` syntax THEN preview SHALL show "alias" but the link still resolves to "Title".

---

## Edge Cases

- Self-references (`[[<my-own-title>]]`) resolve to self (allowed, no special UI).
- Circular link graphs supported (no traversal; just a list).
- Wikilinks with characters needing URL-encoding kept as-is in target_text.
- Case-insensitive matching for filename/title (Obsidian-compatible).

## Requirement Traceability

| ID         | AC                       | Status  |
| ---------- | ------------------------ | ------- |
| WIKI-01    | Resolver algorithm       | Pending |
| WIKI-02    | Collision tie-breaker    | Pending |
| WIKI-03    | Persisted resolution     | Pending |
| WIKI-04    | Click resolved → nav     | Pending |
| WIKI-05    | Unresolved style         | Pending |
| WIKI-06    | Create-on-click popover  | Pending |
| WIKI-07    | Pick existing            | Pending |
| WIKI-08    | Rename body propagation  | Pending |
| WIKI-09    | Rename target_id update  | Pending |
| WIKI-10    | Setting toggle           | Pending |
| WIKI-11    | Backlinks accuracy       | Pending |
| WIKI-12    | Hover preview            | Pending |
| WIKI-13    | Aliases support          | Pending |
| WIKI-14    | Case-insensitive match   | Pending |

## Success Criteria

- [ ] Resolution recompute < 50 ms per modified note on 1 k vault.
- [ ] Renaming a note linked from 100 places: rewrite + reindex < 500 ms total.
- [ ] No false positives: unresolved links never show up as backlinks.
