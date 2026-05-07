# F18 – Local Git Sync (v0 + v1 local-only)

## Overview

Enable per-note version history powered by a local git repository inside the vault directory. Every save auto-commits the changed file (debounced to 5 s). A sidebar panel in `NoteMetaPanel` shows up to 30 recent commits for the open note and lets the user restore any prior version.

GitHub OAuth, remote push, and multi-device sync are explicitly **deferred** (see DEFERRED.md § D2).

---

## Requirements

### R1 – Vault git init
- **R1.1** When a vault is opened (at app startup or via `vault.open`), ensure a `.git` directory exists.
- **R1.2** If absent: run `git init -b main` (fallback to `git init` for older git), write a sensible `.gitignore`, and create an initial commit.
- **R1.3** If `git` is not on PATH, skip silently and set `hasGit = false` everywhere.

### R2 – Auto-commit on save
- **R2.1** After `notes.save` succeeds, schedule an auto-commit for that file.
- **R2.2** After `notes.create` succeeds, schedule a "Create" commit for that file.
- **R2.3** Consecutive saves of the same file within a 5-second debounce window are collapsed into a single commit.
- **R2.4** Commit message: `Create <rel-path>` for new files, `Update <rel-path>` for existing.
- **R2.5** Author set to `Noxe <noxe@local>`.
- **R2.6** If `git` is unavailable or `gitAutoCommit` is `false`, skip commit silently.

### R3 – History per note
- **R3.1** New IPC command `vcs.history({ notePath, limit? })` returns `CommitEntry[]` (sha, shortSha, message, authorName, isoDate) for commits touching that file via `git log --follow`.
- **R3.2** Returns `[]` if git is unavailable or no `.git` exists.

### R4 – Restore a version
- **R4.1** New IPC command `vcs.restore({ notePath, sha })` restores the file to the given revision.
- **R4.2** After restoring, an auto-commit is created: `Restore <rel-path> from <shortSha>`.
- **R4.3** Returns `void` on success; returns an `IpcError` on failure.

### R5 – Status / enable flag
- **R5.1** New IPC command `vcs.status` returns `{ enabled, repoPath, hasGit }`.
- **R5.2** Vault-scoped setting `gitAutoCommit: boolean` (default `true`).
- **R5.3** When `false`, auto-commits are skipped but history viewing still works.

### R6 – History sidebar
- **R6.1** New component `NoteHistory` rendered in `NoteMetaPanel` after `TagsField`.
- **R6.2** Shows up to 30 recent commits for the open note (relative time, short message, short SHA).
- **R6.3** Each entry has a "Restore" button; clicking shows an inline confirm (Yes/No).
- **R6.4** On confirm, calls `vcs.restore`, then reloads the editor buffer via `openBuffer`.
- **R6.5** When no history: shows "No history yet." hint.
- **R6.6** When `hasGit = false`: shows calm "Install git to enable history." message.

### R7 – Settings toggle
- **R7.1** Settings panel (Files & Vaults section) includes a toggle "Enable local version history" (vault-scoped).
- **R7.2** Toggle persists via `settings.vaultSave`.

---

## Out of scope (deferred)
- GitHub OAuth / remote push (D2 v1)
- Multi-device sync / conflict resolution (D2 v2–v3)
- Diff view inside sidebar
- `git2` / libgit2 dependency (shell out to `git` only)

---

## Acceptance criteria
- `pnpm typecheck` ✓
- `pnpm test` ✓ (new NoteHistory tests pass, existing tests unaffected)
- `pnpm build` ✓
- `cargo check` (in `src-tauri/`) ✓
- `NoteHistory` panel renders in the note view sidebar
- Opening a vault creates `.git` if absent (when git is available)
- Saving a note eventually produces a commit (visible via `git log` in vault dir)

---

## Status

Implemented (local-only v0+v1):
- Rust `vcs` module with git init, auto-commit debounce (5 s), history, and restore commands
- IPC contract, client, and TypeScript types for `vcs.status`, `vcs.history`, `vcs.restore`
- Vault-scoped `gitAutoCommit` setting wired through settings bridge and UI toggle
- `NoteHistory` sidebar component with restore confirm dialog
- `NoteMetaPanel` updated to embed `NoteHistory`

Deferred to future iterations:
- GitHub remote push (OAuth, `gh` CLI integration) — see DEFERRED.md § D2 v1
- Multi-device pull-on-open and conflict resolution UI — see DEFERRED.md § D2 v2–v3
- In-sidebar diff view
