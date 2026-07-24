# F45 — Note Export

**Status:** IN PROGRESS · **Size:** Medium (spec only, design inline)

## Problem

No way to get a note out of Cork in a shareable format. Target: export the open note as self-contained HTML or PDF, plus copy as Markdown.

## Requirements

- **EXP-01 — Export as HTML** — renders the note body through the SAME unified pipeline the preview uses (extract the processor setup from `MarkdownPreview.tsx` into a shared module rather than duplicating it), inlines a minimal standalone stylesheet (light theme, system font stack — self-contained single file, no external requests), and saves via the OS save dialog (`tauri-plugin-dialog` is already a dependency; check `@tauri-apps/plugin-dialog` JS package — add if missing, it's the sanctioned pairing). Default filename `<note-title>.html`.
- **EXP-02 — Export as PDF** — opens the rendered HTML in a hidden/offscreen approach is NOT required: acceptable v1 is triggering the WebView print dialog (`window.print()`) with a print stylesheet that shows only the rendered note (user picks "Save as PDF"). Document this choice in code comments.
- **EXP-03 — Copy as Markdown** — copies the raw note body (with frontmatter stripped) to the clipboard.
- **EXP-04 — Surfaces** — palette entries "Export note as HTML", "Export note as PDF", "Copy as Markdown" (hint "Export"), visible only with an open note; plus an entry in the native File menu is optional (only if trivial via existing `menu.rs`/`menuActions.ts` pattern).

## Constraints

- Writing the file: use the dialog plugin's save() for the path + a small write path — check if an existing IPC can write arbitrary text (`notes.save` writes .md into vault only); if not, add ONE Rust command `export.write { path, contents }` (path must come from the save dialog, no vault scoping) — IpcContract.ts + Rust in the same commit.
- Files: `src/services/exportNote.ts` (new), shared `src/utils/markdownProcessor.ts` (extracted), `CommandPalette.tsx` entries, optional `src-tauri/src/export.rs`.
- KaTeX CSS: inline the minimal needed or accept math rendering as plain in export v1 — document the choice.

## Verify

`pnpm typecheck && pnpm lint && cargo check`. Manual: export a note with headings/code/wikilinks → open the .html in a browser, looks like the preview; PDF dialog opens; clipboard gets markdown.
