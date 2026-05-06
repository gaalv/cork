# F02 — Vault FS Specification

**Owner phase:** M1
**Depends on:** F01
**Status:** Draft

## Problem Statement

Notes live as plain `.md` files in a user-chosen folder ("vault"). The app must open a vault, list its notes/folders, read and write note content, watch for external changes, and never corrupt user files. v1 supports one vault open at a time (multi-vault is F10).

## Goals

- [ ] Pick / open / remember the active vault.
- [ ] List notes and folders in O(n) with file metadata (size, mtime).
- [ ] Read a note's full markdown content + frontmatter.
- [ ] Save a note atomically (no partial writes).
- [ ] Watch the vault filesystem and emit events to the UI when files change externally.
- [ ] Survive permission errors, missing files, and large vaults (5 k notes).

## Out of Scope

| Feature                | Reason                       |
| ---------------------- | ---------------------------- |
| SQLite indexing        | F03                          |
| Search                 | F07                          |
| Wikilink resolution    | F09                          |
| Multi-vault            | F10                          |
| Conflict resolution UI | v1 = last-write-wins + toast |

---

## User Stories

### P1: Open a vault ⭐ MVP

**User Story:** As a user, I want to point Noxe at a folder of `.md` files, so I can start using it as my notes app.

**Acceptance Criteria:**
1. WHEN the user clicks "Open Vault" THEN the system SHALL open the OS native folder picker.
2. WHEN the user picks a folder THEN the system SHALL persist its path in the app config and emit `vault.opened` to the frontend.
3. WHEN Noxe starts and a vault is configured THEN the system SHALL auto-open it.
4. WHEN the chosen folder doesn't exist or is unreadable THEN the system SHALL show a toast and clear the configured vault.

---

### P1: List vault contents ⭐ MVP

**User Story:** As a user, I want to see all my notes and folders in the rail/drawers, so I can find things.

**Acceptance Criteria:**
1. WHEN a vault is open THEN the system SHALL recursively scan for `*.md` files (depth unlimited; ignores `.git/`, `node_modules/`, anything starting with `.`).
2. WHEN listing returns THEN each entry SHALL include `{ id, path, title, folder, size, mtime }` where `id` is the absolute path's stable hash and `title` is the file's H1 or filename without extension.
3. WHEN the vault has 5 000 files THEN the listing SHALL complete in < 1 s on a recent dev machine.
4. WHEN a folder contains non-`.md` files THEN they SHALL be ignored.

---

### P1: Read a note ⭐ MVP

**User Story:** As a user, I want to open a note and see its content.

**Acceptance Criteria:**
1. WHEN the user opens a note THEN the system SHALL return `{ frontmatter, body, path, mtime }` from disk.
2. WHEN the file has YAML frontmatter (`---\n...\n---`) THEN the system SHALL parse it into a `Record<string, unknown>`.
3. WHEN the file has no frontmatter THEN `frontmatter` SHALL be `{}`.
4. WHEN the file is gone THEN the system SHALL return `IpcError::NotFound`.

---

### P1: Save a note ⭐ MVP

**User Story:** As a user, I want my edits to persist to disk.

**Acceptance Criteria:**
1. WHEN the editor calls `notes.save({ path, frontmatter, body })` THEN the system SHALL serialize `frontmatter` back to YAML, prepend the body, and write to a temp file in the same directory then `rename` over the target (atomic).
2. WHEN the write succeeds THEN the system SHALL emit `vault.fileChanged` with `{ path, source: "internal" }` carrying the new fingerprint.
3. WHEN the same path is being externally watched at that moment THEN the watcher SHALL NOT re-emit (echo) — see R-002.
4. WHEN the disk is full THEN the system SHALL return `IpcError::Io` and the original file SHALL be intact.

---

### P1: Watch the vault ⭐ MVP

**User Story:** As a user, I want changes I make in another app (Obsidian, VS Code) to show up in Noxe immediately.

**Acceptance Criteria:**
1. WHEN a vault is open THEN a Rust watcher (`notify` crate) SHALL run for that root.
2. WHEN a `.md` file is created/modified/renamed/deleted externally THEN the watcher SHALL emit `vault.fileChanged` with `{ path, kind, source: "external" }` to the frontend within 500 ms.
3. WHEN events fire in bursts THEN they SHALL be debounced 200 ms per path (last-event-wins).
4. WHEN a write originated from `notes.save` THEN it SHALL NOT be re-emitted as `external` (echo-loop mitigation per R-002 using `(path, size, mtime)` fingerprint).

---

### P2: Create a new note

**Acceptance Criteria:**
1. WHEN the user invokes "New Note" THEN the system SHALL create `Untitled.md` (or `Untitled-N.md` if collision) in the active folder with empty body and a default frontmatter (`created: <ISO>`).
2. WHEN created THEN the system SHALL return the new path and emit `vault.fileChanged`.

### P2: Delete a note

**Acceptance Criteria:**
1. WHEN delete is invoked THEN the system SHALL move the file to OS trash (not unlink) using `trash` crate.
2. WHEN trash fails THEN it SHALL fall back to a hard delete only after explicit user confirmation.

### P2: Rename a note

**Acceptance Criteria:**
1. WHEN rename is invoked THEN the system SHALL rename the file on disk and emit `vault.fileRenamed { oldPath, newPath }`.
2. WHEN the target name exists THEN the system SHALL return `IpcError::Conflict` without modifying anything.

---

## Edge Cases

- Symlinks inside the vault SHALL NOT be followed.
- File paths with non-UTF-8 bytes SHALL be skipped during listing with a warning log.
- A file with `.md` extension but a binary payload SHALL still be read; if invalid UTF-8, return `IpcError::Parse`.
- Watcher SHALL recover (re-arm) if the vault folder is renamed/recreated.

---

## Requirement Traceability

| ID       | Story / AC               | Phase | Status  |
| -------- | ------------------------ | ----- | ------- |
| VAULT-01 | Open vault picker        | Tasks | Pending |
| VAULT-02 | Persist active vault     | Tasks | Pending |
| VAULT-03 | Auto-open on launch      | Tasks | Pending |
| VAULT-04 | List notes recursively   | Tasks | Pending |
| VAULT-05 | List perf 5k <1s         | Tasks | Pending |
| VAULT-06 | Frontmatter parse        | Tasks | Pending |
| VAULT-07 | Read note + mtime        | Tasks | Pending |
| VAULT-08 | Atomic save              | Tasks | Pending |
| VAULT-09 | Internal write event     | Tasks | Pending |
| VAULT-10 | Watcher external events  | Tasks | Pending |
| VAULT-11 | Watcher debounce         | Tasks | Pending |
| VAULT-12 | Echo-loop mitigation     | Tasks | Pending |
| VAULT-13 | Create note              | Tasks | Pending |
| VAULT-14 | Delete to trash          | Tasks | Pending |
| VAULT-15 | Rename note              | Tasks | Pending |
| VAULT-16 | Skip hidden / non-md     | Tasks | Pending |
| VAULT-17 | Error handling (NotFound, Io, Parse, Conflict) | Tasks | Pending |

---

## Success Criteria

- [ ] Opening a 5 000-note vault lists in < 1 s.
- [ ] Saving a note while VS Code edits the same file does not produce two competing events to the frontend.
- [ ] Killing Noxe mid-save leaves the original file intact (atomic).
- [ ] Watcher remains responsive after 1 hr of running with 100 saves/min.
