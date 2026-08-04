# Changelog

All notable changes to Cork will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
