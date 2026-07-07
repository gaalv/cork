# Changelog

All notable changes to Cork will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

### Added

- Local-first Markdown vault: notes are plain `.md` files on disk
- CodeMirror 6 editor with syntax highlighting, inline code blocks, and frontmatter support
- Wikilinks (`[[note]]`) and backlinks panel
- KaTeX math rendering and Mermaid diagram support
- Full-text search powered by SQLite FTS5
- Triage 3-column layout (Sidebar, Notes list, Editor) inspired by Linear
- Command palette for keyboard-driven navigation
- Folder management: create, rename, move, delete
- Note metadata inspector (word count, backlinks, created/modified dates)
- File watcher with 200ms debounce for live index sync
- Vim mode (optional)
- Light and dark themes
- macOS-native window with traffic light positioning
