# F16 — Live Preview Editor (Single-pane WYSIWYG-like Markdown)

## Problem

Today the note view is a 50/50 split: raw markdown on the left (CodeMirror) and rendered HTML on the right (`Preview`). This:

- Wastes horizontal space on small windows.
- Forces context-switching to see the rendered output.
- Doesn't match the Obsidian / Tolaria UX the product is targeting (single pane that visually renders as the user types).

The user explicitly asked: _"Eu gostaria de um editor igual o tolaria tem, onde ele ja digita e ja sai o preview... O obsidian tbm, ja digitava e ja saia no modo preview, nao era dividido em 2 modos"_.

## Goals

- G1 — Single pane: typing and reading happen in the same surface.
- G2 — WYSIWYG-feel for the most common markdown inline elements (headings, emphasis, code, links, wikilinks).
- G3 — Lossless: the file on disk remains plain markdown. No proprietary block format.
- G4 — Fast: no perceptible lag while typing on a normal laptop. No re-mounting the editor.
- G5 — Preserve all existing CM6 features already invested in: slash menu, wikilink autocomplete, tag autocomplete, drop/paste, theme tokens, line wrap setting, etc.

## Non-goals (v1)

- Block-level WYSIWYG of fenced code blocks, math (KaTeX), or Mermaid in the editor itself. The current Shiki/KaTeX/Mermaid pipeline lives in `Preview.tsx`; for v1 those blocks remain visible as raw markdown inside the editor. A future feature can promote them to inline rendered widgets.
- Inline rendered images (`![](...)`). Source stays visible.
- Migrating to BlockNote / Tiptap / ProseMirror. Tolaria uses BlockNote, but BlockNote stores its own block JSON and would require a lossy markdown round-trip incompatible with G3 and with the file-on-disk vault model. We stay on CodeMirror 6 and use the same Live Preview technique Obsidian uses (decorations that conceal markers when the caret is off the line).

## Functional requirements

- **FR1 — Single pane**: `EditorPreviewSplit` is removed. `NoteView` renders only `<Editor />` filling the available width.
- **FR2 — Heading concealment**: lines matching `^(#{1,6})\s` keep their existing visual weight (already provided by `headingSizes`), and the `#`/`##`/`###` marker plus its trailing space are hidden whenever the caret is not on that line.
- **FR3 — Bold**: ranges matching `**…**` (and `__…__`) render bold; the `**`/`__` markers are hidden when the caret is outside the range.
- **FR4 — Italic**: ranges matching `*…*` / `_…_` render italic; markers hidden when the caret is outside. Must not collide with bold (skip `**…**` / `__…__`).
- **FR5 — Strikethrough**: ranges matching `~~…~~` render strikethrough; markers hidden when the caret is outside.
- **FR6 — Inline code**: ranges matching `` `…` `` render with the existing inline-code class; backticks hidden when the caret is outside.
- **FR7 — Markdown links**: `[label](url)` renders only `label` (styled as a link, underlined on hover) when the caret is outside; the full source is shown when the caret is inside the range so the user can edit. ⌘/Ctrl-click on the rendered label opens the URL via the existing `openUrl` helper.
- **FR8 — Wikilinks**: existing `concealedBrackets` behaviour is preserved (already conceals `[[...]]` when caret is outside).
- **FR9 — Source/edit toggle**: a per-note toggle (default _live_) exposes a "source" view where ALL the new live-preview decorations are disabled and the raw markdown is shown. Wired to ⌘. (which today toggles the preview pane). Persisted per-session via the existing `useNoteViewStore`.
- **FR10 — No focus loss while typing**: the editor view must NOT be remounted while the user types or while decorations update. (Pre-requisite already shipped in commit `76045f3`, kept here as an explicit requirement.)
- **FR11 — Existing CM extensions keep working**: slash menu, wikilink/tag autocomplete, line numbers, line wrap, drop/paste of attachments, search, theme.
- **FR12 — Tests**: every new decoration plugin has a unit test covering "decorates when caret outside" and "reveals when caret inside".

## Out of scope

- Inline render of fenced code blocks (Shiki).
- Inline render of `$$ … $$` and `$ … $` (KaTeX).
- Inline render of `mermaid` blocks.
- Inline image rendering.
- Spec for a future "preview window" command (the existing `Preview.tsx` keeps living in the codebase and can be reused later for export/print or a popover preview; but it is no longer wired into the note layout).

## Acceptance criteria

- AC1 — Open a note. Type `# Hello`. The `# ` marker is hidden as soon as the caret leaves the line; pressing ↑/↓ to that line shows the marker again.
- AC2 — Type `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``. While the caret is outside each range, only the rendered text is visible (no markers); while inside, the markers reappear.
- AC3 — Type `[GitHub](https://github.com)`. Caret outside the range: only `GitHub` is shown, underlined-on-hover. Caret inside: full source. ⌘-clicking on `GitHub` opens the URL in the OS default browser.
- AC4 — Pressing ⌘. (or Ctrl-. on Windows/Linux) toggles between live and source mode. The state survives navigation away and back to the same note within the session.
- AC5 — Wikilink concealment continues to work as before.
- AC6 — Typing 200 characters in a row never resets focus; cursor remains in place.
- AC7 — `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass.
- AC8 — No regression in autosave (`useAutoSave`), external reconcile (`useExternalReconciler`), or drop/paste.

## Risks & mitigations

- R1 — Decoration overlap (bold vs italic). Mitigation: a single `liveMarkdownDecorations` ViewPlugin owns all inline mark/conceal decorations and resolves them in one pass with a precedence list (bold → italic → strike → code → link), avoiding double-counting.
- R2 — Performance on large docs. Mitigation: only iterate over `view.visibleRanges`, regex per visible chunk; the same pattern `concealedBrackets` and `headingSizes` already use scales fine.
- R3 — Code fences contain `*` etc. that look like emphasis. Mitigation: skip ranges inside fenced code blocks and inline code by walking line-aware: we will rely on the `markdown` Lezer tree (`syntaxTree(state)`) to identify code spans / fenced code blocks and exclude them.
