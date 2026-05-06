# F03 — Index Specification

**Owner phase:** M1
**Depends on:** F02
**Status:** Draft

## Problem Statement

Reading raw `.md` files is fine for one note, but expensive for search, backlinks, recent lists, tag indexes, and "all notes" views. We need a SQLite-backed index, derived deterministically from the vault, kept in sync by the watcher. The index is a **derivative** — losing it must be recoverable by re-scanning.

## Goals

- [ ] On vault open, build/refresh the index in under 3 s for 1 000 notes.
- [ ] Persist index in `<app-data>/vaults/<vault-hash>/index.sqlite`.
- [ ] On file change, update index incrementally in < 200 ms.
- [ ] Provide query commands: `notes.recent`, `notes.byTag`, `notes.byFolder`, `notes.byId`, `tags.list`, `links.outgoing`, `links.incoming`.
- [ ] Use FTS5 for body+title search (consumed by F07).

## Out of Scope

| Feature                       | Reason  |
| ----------------------------- | ------- |
| Search drawer UI              | F07     |
| Wikilink resolution algorithm | F09     |
| Mermaid/code preview          | F05     |

---

## User Stories

### P1: Initial index build ⭐ MVP

1. WHEN a vault is opened for the first time THEN the system SHALL parse all `.md` files and populate `notes`, `tags`, `note_tags`, `links`, `frontmatter`, and FTS tables.
2. WHEN building THEN parsing SHALL use `pulldown-cmark` once per file.
3. WHEN files exceed 1 MB THEN the system SHALL still index them but log a warning.
4. WHEN building THEN progress SHALL be emitted as `index.progress { processed, total }` events at most every 100 ms.

### P1: Incremental updates ⭐ MVP

1. WHEN `vault.fileChanged { kind: 'modified', path }` arrives THEN the system SHALL re-parse just that file and replace its rows in `notes`, `note_tags`, `links`, `frontmatter`, and FTS within 200 ms.
2. WHEN `kind: 'created'` THEN insert.
3. WHEN `kind: 'removed'` THEN delete by id.
4. WHEN `vault.fileRenamed` THEN update the path/folder/title and **rewrite** any wikilink targets that resolved to the old path (deferred to F09; this feature only updates the moved row).

### P1: Query commands ⭐ MVP

1. `notes.recent(limit)` SHALL return rows ordered by `mtime DESC`.
2. `notes.byTag(tag)` SHALL return rows whose tag matches OR descends from (`tag/sub`) using a hierarchical lookup.
3. `notes.byFolder(folder)` SHALL return rows whose `folder` column equals or starts with the given prefix.
4. `tags.list()` SHALL return `[{ tag, count }]` sorted by count desc.

### P1: Crash safety

1. WHEN the app is killed mid-write THEN the database SHALL remain consistent (WAL mode, see R-003).
2. WHEN the index is unreadable on launch (corrupt file) THEN the system SHALL delete it and rebuild.

### P2: Frontmatter columns

1. WHEN a note has frontmatter keys `created`, `updated`, `tags`, `aliases` THEN they SHALL be stored in their own columns/tables.
2. WHEN frontmatter `tags` is an array OR a comma string THEN both SHALL parse into the `note_tags` table.

### P2: Two-parser parity

1. WHEN the same markdown is parsed by Rust (`pulldown-cmark`) for indexing AND by JS (`react-markdown`) for preview THEN extracted wikilinks, tags, and headings SHALL be identical (parity test in CI). See R-001.

---

## Edge Cases

- A note with no body but with frontmatter SHALL index with empty body and frontmatter present.
- Tags inside fenced code blocks SHALL NOT be extracted.
- Wikilinks inside fenced code blocks SHALL NOT be extracted.
- Tag with spaces is not allowed; only `[A-Za-z0-9/_-]+` (per Obsidian).

---

## Requirement Traceability

| ID       | Story                       | Phase  | Status  |
| -------- | --------------------------- | ------ | ------- |
| INDEX-01 | Build on open               | Tasks  | Pending |
| INDEX-02 | Build perf 1k <3s           | Tasks  | Pending |
| INDEX-03 | Schema + migrations         | Tasks  | Pending |
| INDEX-04 | Frontmatter columns         | Tasks  | Pending |
| INDEX-05 | Tag extraction              | Tasks  | Pending |
| INDEX-06 | Link extraction             | Tasks  | Pending |
| INDEX-07 | FTS body+title              | Tasks  | Pending |
| INDEX-08 | Incremental modify          | Tasks  | Pending |
| INDEX-09 | Incremental create          | Tasks  | Pending |
| INDEX-10 | Incremental remove          | Tasks  | Pending |
| INDEX-11 | Rename row                  | Tasks  | Pending |
| INDEX-12 | notes.recent                | Tasks  | Pending |
| INDEX-13 | notes.byTag                 | Tasks  | Pending |
| INDEX-14 | notes.byFolder              | Tasks  | Pending |
| INDEX-15 | tags.list                   | Tasks  | Pending |
| INDEX-16 | links.outgoing/incoming     | Tasks  | Pending |
| INDEX-17 | WAL + crash safety          | Tasks  | Pending |
| INDEX-18 | Rebuild on corruption       | Tasks  | Pending |
| INDEX-19 | Two-parser parity test      | Tasks  | Pending |
| INDEX-20 | Progress events             | Tasks  | Pending |

## Success Criteria

- [ ] 1 k-note vault: full build < 3 s; per-file update < 200 ms.
- [ ] FTS query for a 3-letter prefix returns < 50 ms on 1 k notes.
- [ ] Killing the app mid-build leaves the DB recoverable on next launch.
- [ ] Parser parity test passes for the fixture vault.
