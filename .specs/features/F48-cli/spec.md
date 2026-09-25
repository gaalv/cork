# F48 — Cork CLI Specification

**Status:** DRAFT · **Size:** Large (spec + design + tasks)

## Problem Statement

Cork's workflow leans heavily on AI/automation, but the only way to act on a vault is the GUI. Notes are plain `.md` on disk, so an agent _could_ write raw files — but that bypasses every invariant Cork enforces (frontmatter shape, wikilink propagation on rename, tag frontmatter, folder rules, the SQLite index) and gives no read/query path (FTS, backlinks). We want a first-class `cork` command that does _almost everything the app can do_ to a vault — create folders, manage tags, retitle notes, add/remove tags — reusing the exact same backend logic, installable alongside the desktop app.

## Goals

- [ ] A `cork` command on PATH that performs vault mutations through the **same Rust logic** the GUI uses (no reimplementation, no invariant drift)
- [ ] Covers the mutation surface the user needs: notes (new/retitle/move/trash/list/show), folders (new/rename/move/trash/list), tags (add/remove on a note, vault-wide rename/delete, list)
- [ ] Operates on the **same index** the GUI uses (AD-004 path scheme) and reconciles cleanly whether or not the app is running
- [ ] Installs **together with the app** from the existing single-artifact install flow (`install.sh`), version-locked to the app
- [ ] Scriptable/agent-friendly: `--json` output and honest exit codes

## Out of Scope

| Feature                               | Reason                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| MCP server                            | Decided against for now — CLI is the chosen interface (agents shell out to it) |
| Sync / git commands (`vcs.*`)         | Sync has its own lifecycle (F18/F26/F37); CLI drives content, not sync         |
| AI skill invocation from CLI (`ai.*`) | The app is the LLM client; CLI is for vault ops. Revisit if asked              |
| Interactive TUI / REPL                | One-shot commands only; composability comes from the shell, not a TUI          |
| Watching the vault from the CLI       | The GUI owns the watcher; CLI does one-shot reindex (see CLI-09)               |
| Windows ARM / Linux ARM CLI           | Follows the app's existing platform matrix (`install.sh`)                      |

---

## User Stories

### P1: Run `cork` as a headless command next to the app ⭐ MVP

**User Story**: As a developer, I want the same binary that runs the Cork app to also run as a CLI when I pass a subcommand, so I don't manage two installs or worry about version skew.

**Why P1**: Nothing else works without this. The dual-mode entry and the core-logic extraction are the foundation the whole feature stands on.

**Acceptance Criteria**:

1. WHEN the binary is invoked with a recognized subcommand (`cork tag add …`) THEN it SHALL run headless and exit **before** the Tauri event loop / any window is created
2. WHEN the binary is invoked with no args (double-click, `open -a Cork`) THEN it SHALL launch the GUI exactly as today
3. WHEN `cork --version` is run THEN it SHALL print the same version as the app bundle (single source: `tauri.conf.json` / `Cargo.toml`)
4. WHEN on Windows a subcommand is run from a terminal THEN stdout/stderr SHALL be visible despite `windows_subsystem = "windows"` (console attached in CLI mode)
5. WHEN the installer runs THEN `cork` SHALL be resolvable on PATH on macOS and Linux (Linux shim already exists; macOS gets a symlink into the bundle)

**Independent Test**: `cork --version` prints the app version; double-clicking Cork still opens the GUI.

---

### P1: Mutate notes from the CLI ⭐ MVP

**User Story**: As a developer, I want to create, retitle, move, trash, list, and show notes from the terminal so I (or an agent) can drive the vault without the GUI.

**Why P1**: "Trocar título" and note creation are core asks; retitle in particular _must_ go through wikilink propagation, which is exactly why raw file writes are insufficient.

**Acceptance Criteria**:

1. WHEN `cork note new "<title>" [--folder <path>] [--tag <t>…]` runs THEN system SHALL create the `.md` via the same path as `notes.create`, with frontmatter, in the target folder, and print the new note's path
2. WHEN `cork note retitle <path|id> "<new title>"` runs THEN system SHALL rename the file **and rewrite incoming wikilinks** via the same `rename_propagation` logic as `notes.rename`
3. WHEN `cork note mv <path|id> <folder>` runs THEN system SHALL move the note (same logic as `notes.move`)
4. WHEN `cork note rm <path|id>` runs THEN system SHALL trash the note (same logic as `notes.trash`, OS trash — not hard delete)
5. WHEN `cork note ls [--folder <f>] [--tag <t>] [--status <s>]` runs THEN system SHALL list matching notes from the index
6. WHEN `cork note show <path|id>` runs THEN system SHALL print the note (body, optionally frontmatter) to stdout
7. WHEN a `<path|id>` argument matches no note THEN system SHALL exit non-zero with a clear stderr message and change nothing

**Independent Test**: `cork note new "Foo" --tag bar` creates the file; `cork note retitle Foo "Baz"` renames it and a note linking `[[Foo]]` now links `[[Baz]]`.

---

### P1: Manage folders from the CLI ⭐ MVP

**User Story**: As a developer, I want to create, rename, move, trash, and list folders from the terminal.

**Acceptance Criteria**:

1. WHEN `cork folder new <path>` runs THEN system SHALL create the folder via the same logic as `folders.create`
2. WHEN `cork folder rename <path> <new-name>` / `cork folder mv <path> <dest>` / `cork folder rm <path>` run THEN system SHALL use `folders.rename` / `folders.move` / `folders.trash` logic respectively
3. WHEN `cork folder ls` runs THEN system SHALL print the folder tree from `folders.list`
4. WHEN a folder operation would collide with an existing name THEN system SHALL fail with the same error the GUI surfaces (no silent overwrite)

**Independent Test**: `cork folder new Projects/Alpha` then `cork folder ls` shows it; the GUI (if open) shows it appear.

---

### P1: Manage tags from the CLI ⭐ MVP

**User Story**: As a developer, I want to add/remove tags on a note, rename or delete a tag across the vault, and list tags — from the terminal.

**Why P1**: Explicit user ask ("adicionar remover tags"). Tag-on-note is a frontmatter mutation; vault-wide rename/delete must rewrite every affected note's frontmatter, which is exactly what the GUI path does.

**Acceptance Criteria**:

1. WHEN `cork tag add <path|id> <tag>…` runs THEN system SHALL add each tag to the note's frontmatter `tags:` list (idempotent; no duplicates) and reindex — matching the GUI's tag-on-note persistence
2. WHEN `cork tag rm <path|id> <tag>…` runs THEN system SHALL remove each tag from the note's frontmatter (removing the key when the list empties)
3. WHEN `cork tag rename <old> <new>` runs THEN system SHALL rewrite `<old>`→`<new>` in the frontmatter of **every** note carrying it (same as `tags.rename`)
4. WHEN `cork tag rm-all <tag>` runs THEN system SHALL remove `<tag>` from every note's frontmatter (same as `tags.delete`)
5. WHEN `cork tag ls [<path|id>]` runs THEN system SHALL list all tags with counts, or just the given note's tags
6. WHEN a tag string is malformed (whitespace, leading `#`) THEN system SHALL normalize it the same way the GUI/indexer does, or reject with a clear message

**Independent Test**: `cork tag add Foo urgent` → `Foo.md` frontmatter gains `tags: [urgent]`; `cork tag rename urgent p1` → it becomes `p1` in every note.

---

### P2: Query the vault from the CLI

**User Story**: As a developer/agent, I want to search notes and inspect links so the CLI is a two-way tool, not write-only.

**Acceptance Criteria**:

1. WHEN `cork search "<query>"` runs THEN system SHALL run the same FTS query as `notes.search`/`index.search` and print ranked hits
2. WHEN `cork links <path|id> [--incoming|--outgoing]` runs THEN system SHALL print backlinks/outgoing links (`links.incoming`/`links.outgoing`); default shows both
3. WHEN `cork reindex` runs THEN system SHALL rebuild the index for the selected vault (same as `index.rebuild`)

**Independent Test**: `cork search "foo" --json | jq` returns structured hits.

---

### P2: Machine-readable output

**User Story**: As an agent/script, I want `--json` on every command and reliable exit codes so I can parse results and detect failure.

**Acceptance Criteria**:

1. WHEN `--json` is passed to any command THEN system SHALL print a single JSON document to stdout and nothing else on stdout
2. WHEN a command succeeds THEN exit code SHALL be 0; WHEN it fails THEN exit code SHALL be non-zero and a human message SHALL go to **stderr** (never polluting `--json` stdout)
3. WHEN no `--json` is passed THEN output SHALL be concise human-readable text (paths, counts, tables)

---

### P3: Convenience & completeness

**User Story**: As a power user, I want the remaining vault ops and shell ergonomics.

**Acceptance Criteria**:

1. WHEN `cork archive <path|id>` / `cork restore <path|id>` / `cork archive ls` run THEN system SHALL use `archive.*` logic
2. WHEN `cork completions <shell>` runs THEN system SHALL emit a completion script (fish/zsh/bash)
3. WHEN `cork note new --from-template <name>` runs THEN system SHALL use `notes.createFromTemplate`

---

## Edge Cases

- WHEN no vault can be resolved (`--vault` absent, cwd not inside a vault, no recent vault) THEN system SHALL exit non-zero with a message explaining how to pass `--vault`
- WHEN the GUI is running and holds the SQLite index THEN CLI writes SHALL not corrupt or deadlock the db (WAL + `busy_timeout`); the GUI's watcher reconciles its own view
- WHEN the CLI mutates a `.md` while the app has that note open with unsaved edits THEN the file on disk is changed and the app's watcher will surface a conflict/reload per existing behavior — the CLI SHALL NOT try to coordinate in-app buffer state (documented limitation)
- WHEN a `<path|id>` is ambiguous (title matches multiple notes) THEN system SHALL error and list the candidates rather than guessing
- WHEN the resolved index db does not exist yet (vault never opened in the app) THEN system SHALL build it on first use (one-shot index) before running the command
- WHEN a subcommand name collides with a future Tauri CLI plugin arg THEN dual-mode dispatch SHALL prefer the explicit `cork` subcommand grammar (documented in design)

---

## Requirement Traceability

| Requirement ID | Story                                                                  | Phase | Status  |
| -------------- | ---------------------------------------------------------------------- | ----- | ------- |
| CLI-01         | P1: Dual-mode binary entry (args → headless, else GUI)                 | Tasks | Pending |
| CLI-02         | P1: `VaultCtx` core — ops without `AppHandle`/`State`, emit abstracted | Tasks | Pending |
| CLI-03         | P1: Index/vault path parity with GUI (AD-004 scheme)                   | Tasks | Pending |
| CLI-04         | P1: Vault resolution (`--vault` / cwd / recent)                        | Tasks | Pending |
| CLI-05         | P1: Note commands (new/retitle/mv/rm/ls/show)                          | Tasks | Pending |
| CLI-06         | P1: Folder commands (new/rename/mv/rm/ls)                              | Tasks | Pending |
| CLI-07         | P1: Tag commands (add/rm on note, rename, rm-all, ls)                  | Tasks | Pending |
| CLI-08         | P2: Query (search, links, reindex)                                     | Tasks | Pending |
| CLI-09         | P1: Reconciliation (write `.md` + one-shot reindex, WAL)               | Tasks | Pending |
| CLI-10         | P2: `--json` output + exit codes                                       | Tasks | Pending |
| CLI-11         | P1: Windows console attach in CLI mode                                 | Tasks | Pending |
| CLI-12         | P1: Install parity (macOS symlink, Linux shim, PATH)                   | Tasks | Pending |
| CLI-13         | P3: Archive / completions / templates                                  | -     | Pending |

**Coverage:** 13 total, 12 mapped to tasks (CLI-13 deferred to P3), 0 unmapped for P1/P2.

---

## Success Criteria

- [ ] Every P1 command mutates the vault through the **same Rust functions** as the GUI (verified by call-site, not reimplementation)
- [ ] `cork` and the app ship from one `install.sh` run, report the same `--version`, and coexist without a second download
- [ ] With the app open, a `cork tag add …` shows up in the GUI within the watcher debounce window, with no index corruption
- [ ] `cork <cmd> --json` output parses cleanly and exit codes are honest (0 / non-zero)
