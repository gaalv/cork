# Changelog

All notable changes to Cork will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] — unreleased

Editor rendering, theming and note-creation fixes, plus Windows and Linux builds.

### Added

- Bundled Inter and IBM Plex Mono, selectable for the interface, the writing surface and code — self-hosted, so the app makes no network requests
- Editor line-height setting, and a live type specimen in Settings › Editor
- Windows (`.msi`, `.exe`) and Linux (`.deb`, `.rpm`, `.AppImage`) release builds
- Linux install via Homebrew (`brew install cork`) — macOS continues to use the cask
- Development builds are marked with an outline and a corner badge, so they cannot be confused with an installed release
- A first-run tour of the sidebar, notes list, editor and command palette — skippable at any step, replayable from Settings › General
- Choose what AI should optimise for — Balanced, Quality or Economy — with per-task-type model overrides under Advanced, and a Test button that runs the CLI and reports what it says
- Codex joins Claude and GitHub Copilot as an AI provider
- **Structure as meeting note** — turns a pasted transcript into attendees, summary, decisions, action items and open questions, keeping the transcript underneath
- **Ask your vault** (⌘K) — ask a question and get an answer built only from your own notes, citing the ones it read
- **Triage the Inbox** (⌘K) — proposes a folder, tags and a real title for each unfiled note, one at a time, nothing applied without your approval
- **Suggest links** — finds notes this one should reference and turns the right phrase into a wikilink
- **Find duplicates** — spots notes that cover the same ground and should probably be merged
- **What changed** — turns a note's git history into a plain-English account of how it evolved
- **Brief today's daily note** (⌘K) — starts the day from your unfinished tasks and the threads you were on, instead of a blank page
- Export, import, templates and the vault-wide AI actions are now in the menu bar, not only the command palette. On Windows and Linux that menu renders inside the window, so all three platforms get them
- **Activity** in the status bar — a short log of what Cork did unattended: a sync that failed or succeeded, a note that changed on disk under an open buffer, an available update. Only failures raise the badge. It replaces a "notifications" panel that held a hardcoded changelog and had no data source
- Update notices: when a new version ships, Cork shows the upgrade command for however you installed it. Cork never replaces itself behind your package manager

### Fixed

- **Font size setting had no effect** — the editor pinned a fixed size that overrode it
- **Multi-line `$$…$$` never rendered.** Single-line display maths and inline maths also stayed raw when KaTeX finished loading after first paint
- **Image previews never appeared.** Pasted or dropped images showed only the Markdown link; images in notes inside a folder resolved to the wrong path
- **Code blocks rendered almost monochrome** — most syntax tokens collapsed onto two greys that were invisible in dark mode
- **Fix spelling reported success and changed nothing.** AI edits were written to the store, which the editor deliberately ignores while a buffer is dirty — so the file on disk and the text on screen diverged and the next keystroke undid the correction. The daily brief and AI link insertion had the same defect
- Prose containing currency (`$5-$10`) was swallowed as a formula
- `> [!warning]` callouts rendered as raw `!warning` instead of a styled label
- The note status field was a native macOS control that ignored the theme and dropped the coloured dot the rest of the app uses for status
- Quotes, callouts and code blocks had no padding — content sat flush against the block edges
- Markdown markers stayed raw on the last-edited line after clicking away from the editor
- Task lines shifted sideways when the caret entered them
- **The native menu did nothing.** Every custom item — New Note, Open Vault, Find, Toggle Folders — was inert: the backend emitted one event name and the frontend listened for another, and the ids did not match either. What appeared to work was the keyboard shortcut, bound separately
- **Toasts ignored dark mode**, rendering white-on-red over the dark interface
- Seven buttons and the settings toggle were unreadable in dark mode (white text on a near-white background)
- Four strings shipped in Portuguese — the outline heading, the tag filter placeholder and the relative timestamps, which also disagreed with the notes list about how to write the same elapsed time
- Tailwind `dark:` styles followed the OS appearance instead of the app's theme setting
- **AI providers and GitHub sync reported "not found on PATH"** even when the CLIs worked in the terminal — a GUI app does not inherit the shell's PATH
- Wikilinks did not follow on a plain click, and never resolved folder-qualified targets such as `[[References/Cheatsheet]]`
- Clicking a wikilink to a note that does not exist failed silently
- **Unlinked mentions listed unrelated notes.** A placeholder title like "Untitled" matched every scratch note in the vault, and an accented title such as "Configuração" matched nothing at all

### Removed

- **Vim mode.** It was listed as a v2 feature in the editor spec, shipped ahead of that, cost 40 kB gzipped — 8% of the whole bundle — for something off by default, and interacted badly with live preview. The `vimMode` setting is ignored; nothing else changes.

### Changed

- **New notes now land in the vault root when no folder is selected**, instead of an `inbox/` directory. This matches how the sidebar defines the Inbox — notes created before this release stay where they are
- Quick capture always targets the Inbox, opens straight into an editable note, and titles it with a timestamp
- Every entry point (`⌘N`, the notes-list button, the command palette, the app menu, templates) now resolves the destination the same way
- Moving the caret past hidden Markdown — a task's `- [ ]`, a rendered table, an embedded image — now steps over it in one keypress instead of stalling on each invisible character
- The preview pane shares the editor's typography, so toggling preview no longer reflows the text

## [0.1.0] — 2026-08-03

Initial public release.

### Vault & notes

- Local-first Markdown vault: notes are plain `.md` files on disk, portable to any other editor
- SQLite index (FTS5) with live file watching — external edits show up instantly
- Folder management: create, rename, move, drag-and-drop, trash with confirmation
- Folder import: bring an existing folder of Markdown files into the vault
- Inbox as default capture target + macOS tray quick capture (`⌘⇧I` from anywhere)
- Archive-first deletion: notes are archived by default; permanent delete only from the Archived view
- Pinned notes (`pinned:` frontmatter) and per-note status (`active` / `on-hold` / `done`)
- Note templates with variables (`{{title}}`, `{{date}}`, `{{time}}`, `{{datetime}}`, `{{cursor}}`); four starter templates seeded per vault
- Daily notes (`Daily/YYYY-MM-DD.md`, `⌘⇧T`) with template support
- First-run scaffold: new vaults are seeded with a welcome note and starter folders

### Editor

- CodeMirror 6 editor with live preview: inline markers, highlights, callouts, code fences, tables, wikilinks, and inline/display math render in place
- Split-pane preview with Shiki syntax highlighting, KaTeX, and Mermaid diagrams
- Wikilinks (`[[note]]`) with autocomplete, click-to-navigate, and create-on-click for missing notes
- Backlinks and unlinked mentions in the Inspector
- Image drag-and-drop / paste with inline rendering
- In-note find & replace (`⌘F`) and vault-wide find & replace
- Optional spell check and Vim mode
- Autosave with external-change conflict detection

### Navigation & UI

- Triage 3-column layout (Sidebar, Notes list, Editor) with resizable columns
- Command palette (`⌘K`) with full-text content search across the vault
- Graph view (`⌘⇧G`): force-directed canvas of note links
- Calendar popover: month grid with daily-note and activity markers
- Inspector panel: outline, tags, properties, backlinks, history, and AI sections
- Light / dark / system themes; native macOS menu bar and window-state persistence
- Notes list virtualization — smooth with 1k+ note vaults

### Sync & history

- Local git history: auto-commit on save, per-note history with one-click restore
- GitHub sync per vault via fine-grained PAT (HTTPS) or SSH deploy key, with conflict-as-copy resolution
- Erase-proof credential storage and in-place token update — a transient auth failure can never wipe a valid token

### AI (optional, local-only)

- Generate note from topic via local `claude` / `copilot` CLI subprocesses — no API keys, no network calls from Cork itself
- Skills system with per-vault overrides, content-hash cache, and usage telemetry

### Export & diagnostics

- Export notes as self-contained HTML, PDF (print dialog), or copy as Markdown
- Always-on local crash log with redaction and rotation (Settings → Diagnostics)
