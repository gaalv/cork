# F44 — Editor-side Markdown Extension Rendering

**Status:** IN PROGRESS · **Size:** Medium-Large (spec only, design inline)

## Problem

The preview pane already renders callouts, footnotes, highlights, math and mermaid (F14 preview half is DONE — ROADMAP note is stale). The **editor** shows all of it raw. F16-style live preview (src/cm/livePreview.ts) now conceals inline marks; this feature extends it to the remaining F14 extensions + block-level polish so the editor reads like the preview.

## Requirements

All behaviors follow the established live-preview rule: the line(s) under the caret/selection show raw markdown; everything else renders. All decoration-only — the `.md` on disk is never touched. Everything lives behind the existing `editor.livePreview` setting (no new setting).

- **EDX-01 — Highlight `==text==`** — conceal the `==` marks when inactive; content gets a mark decoration with `--color-cork-accent-soft`-style background (match preview's highlight look; reuse/add a token, no hex).
- **EDX-02 — Callouts** — lines of a blockquote whose first line matches `> [!type]` (note/tip/warning/info/etc., case-insensitive) get callout line styling: left border + tinted background per type family (map unknown types to note). The `[!type]` marker line renders with an icon-ish label (widget or styled text) when inactive; raw when active. Nested content lines keep the callout background.
- **EDX-03 — Fenced code blocks** — all lines inside a fence get a `cm-line` background (panel-2) + mono font is already applied by highlighting; the ``` fence marker lines are dimmed when inactive (NOT concealed — collapsing lines is disorienting). Language tag stays visible.
- **EDX-04 — Tables** — pipe-table block lines get mono font + subtle row striping via line decorations so columns align. No widget-based table rendering (out of scope).
- **EDX-05 — Regression guard** — existing conceals (headings, emphasis, links, wikilinks, quotes, bullets, hr, inline code) keep working; decorations from this feature must not produce overlapping replace ranges (reuse the existing sort+dedupe).

## Constraints

- Files: `src/cm/livePreview.ts` (primary — split into `src/cm/livePreview/` folder with index if it grows past ~400 lines), `src/cm/theme.ts` only if tokens needed.
- Use the Lezer tree (`syntaxTree`) — node names: `FencedCode`, `CodeInfo`, `CodeText`, `Table`, `TableHeader`, `TableRow`, `Blockquote`. Callout detection is regex-on-line within Blockquote (Lezer GFM has no callout node).
- Math/mermaid inline widgets are OUT of scope (preview pane covers them).

## Verify

`pnpm typecheck && pnpm lint`. Manual with a note containing `==hi==`, a `> [!warning]` callout, a fenced ts block, a GFM table: everything styled when caret elsewhere, raw per-line under caret.
