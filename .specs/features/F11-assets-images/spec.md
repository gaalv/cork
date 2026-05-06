# F11 — Assets & Images Specification

**Owner phase:** M3
**Depends on:** F02, F05
**Status:** Draft

## Problem Statement

Notes routinely embed local images (`![alt](attachments/foo.png)`), PDFs, and arbitrary attachments. Tauri 2's WebView blocks `file://` by default; without explicit support, every image link in a note's preview shows broken. We need a safe, fast way to render local assets, follow Obsidian-style conventions, and let the user open non-image files in the OS default app.

## Goals

- [ ] Render `![alt](relative/or/abs/path)` images in preview using Tauri's `asset://` protocol (read-only, scoped to the active vault root).
- [ ] Support standard Markdown image syntax AND Obsidian-style `![[image.png]]` (resolved like a wikilink).
- [ ] Support `[file.pdf](relative/path)` — clicking opens via OS default app (Tauri `shell.open` with safelist).
- [ ] Sane default attachments folder per vault (`<vault>/attachments/`); configurable via per-vault settings.
- [ ] Drag-and-drop an image onto the editor copies the file into the attachments folder and inserts the link.
- [ ] Paste an image from clipboard into the editor saves to attachments + inserts link.
- [ ] Block remote URLs (`http`, `https`) only when user opts into "offline mode" (default: allow); never block local.

## Out of Scope

| Feature                         | Reason  |
| ------------------------------- | ------- |
| Image resize handles in editor  | v2      |
| Inline image upload to remote   | v2 (offline-first) |
| Video / audio playback embedded | v2 (use OS default opener for now) |
| Image cropping / annotation     | v2      |

---

## User Stories

### P1: Render local images in preview ⭐ MVP

1. WHEN the preview encounters `![alt](path)` AND `path` resolves to a file inside the active vault THEN the system SHALL render an `<img src="asset://localhost/<absolute-path>">`.
2. WHEN the path is relative THEN it SHALL be resolved against the current note's directory.
3. WHEN the path resolves OUTSIDE the vault root THEN the system SHALL NOT render and SHALL show an inline warning "External path blocked".
4. WHEN the file does not exist THEN the system SHALL render a placeholder with the alt text and a tooltip "File not found: <path>".

### P1: Obsidian-style image embed ⭐ MVP

1. WHEN the preview encounters `![[image.png]]` THEN the system SHALL resolve via the same algorithm as wikilinks (F09) but for binary files (search filename in vault, prefer attachments folder).
2. WHEN multiple matches THEN pick the one nearest to the current note's folder.
3. WHEN none THEN render placeholder.

### P1: Open file in OS default app ⭐ MVP

1. WHEN preview encounters a non-image link with extension in safelist (`pdf, txt, csv, json, mp4, mov, mp3, wav, zip, docx, xlsx, pptx`) AND target inside vault THEN clicking SHALL invoke `shell.open` on the absolute path.
2. WHEN extension not in safelist THEN clicking SHALL show a confirmation toast: "Open <name> in default app?" with Yes/No.
3. WHEN target outside vault THEN block + warning.

### P1: Drag-and-drop into editor ⭐ MVP

1. WHEN the user drops one or more files onto the editor area THEN the system SHALL: copy each file to `<vault>/<attachmentsFolder>/<original-name>` (collision → suffix `-1`, `-2`), and insert at cursor either `![alt](...)` (images) or `[name](...)` (others).
2. WHEN dropping while not in an editor THEN drop is ignored.

### P1: Paste image from clipboard ⭐ MVP

1. WHEN the user pastes an image from clipboard THEN the system SHALL save as `Pasted Image YYYYMMDDHHmmss.png` to attachments and insert `![](relative-path)`.

### P2: Configurable attachments folder

1. WHEN per-vault config has `attachmentsFolder` THEN it SHALL be used (default `attachments`).
2. WHEN attachmentsFolder is empty string THEN saves go to the same folder as the active note (Obsidian "Same folder" mode).

### P2: Remote URL gating

1. WHEN setting `offlineMode = true` THEN preview SHALL replace remote `<img>` with a placeholder + "Click to load".
2. WHEN user clicks placeholder THEN the actual URL SHALL load (per-link allow).

---

## Edge Cases

- WHEN the vault is symlinked: resolve to the canonical path before scope check.
- WHEN file path contains spaces / non-ASCII: must round-trip through Tauri asset protocol correctly (URL-encode segments).
- WHEN a 50 MB image is rendered: lazy-load via `loading="lazy"` on `<img>`.
- WHEN clipboard has both image and text: prefer image.
- WHEN dropping a folder: skip with toast "Folders not supported yet".

---

## Requirement Traceability

| ID       | AC                                       | Status  |
| -------- | ---------------------------------------- | ------- |
| ASSET-01 | Render local images via asset://         | Pending |
| ASSET-02 | Relative path resolution                 | Pending |
| ASSET-03 | Out-of-vault block + warning             | Pending |
| ASSET-04 | Missing-file placeholder                 | Pending |
| ASSET-05 | Obsidian `![[image]]` resolution         | Pending |
| ASSET-06 | Open file safelist                       | Pending |
| ASSET-07 | Open file confirmation (non-safelist)    | Pending |
| ASSET-08 | Drag-and-drop copy + insert              | Pending |
| ASSET-09 | Clipboard paste image                    | Pending |
| ASSET-10 | Configurable attachments folder          | Pending |
| ASSET-11 | Same-folder mode                         | Pending |
| ASSET-12 | Offline-mode remote gating               | Pending |
| ASSET-13 | URL encoding correctness                 | Pending |
| ASSET-14 | Lazy-load images                         | Pending |

## Success Criteria

- [ ] 1000-image note loads preview without freezing the UI (lazy-loading verified).
- [ ] Drag of 5 files completes in < 500 ms; all 5 inserted at cursor in order.
- [ ] No regression on F05's typing latency.
