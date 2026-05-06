# F14 — Markdown Extensions Specification

**Owner phase:** M5
**Depends on:** F05, F08
**Status:** Draft

## Problem Statement

Out of the box, the F08 parity matrix supports CommonMark + GFM only. Users coming from Obsidian expect callouts (`> [!note]`), footnotes, and `==highlight==`. We add these as opt-in flags to keep CommonMark parity intact and parser-symmetric (Rust + TS).

## Goals

- [ ] Obsidian-style callouts: `> [!note] Title` block → styled panel.
- [ ] Footnotes: `[^1]` references + `[^1]: text` definitions.
- [ ] Highlight: `==text==` → `<mark>`.
- [ ] All extensions feature-flagged via Settings (F13). Default: callouts on, footnotes on, highlight on.
- [ ] Parity tests extended; both pulldown-cmark and unified pipelines pass parity for new fixtures.

## Out of Scope

| Feature                | Reason  |
| ---------------------- | ------- |
| Definition lists       | Defer to v1.x |
| Task list custom states (`- [/]`, `- [-]`) | v2 |
| Math (KaTeX)           | v2      |
| Mermaid diagrams       | v2      |
| Templater-like syntax  | v2      |

---

## User Stories

### P1: Callouts ⭐ MVP

1. WHEN preview encounters a blockquote whose first line is `> [!<kind>] <optional title>` THEN it SHALL render as `<aside class="callout callout-<kind>" data-kind="<kind>"><header>...</header><div>...</div></aside>`.
2. WHEN `<kind>` is one of `note|info|tip|warning|danger|success|quote|abstract|example` THEN icon + color theme apply.
3. WHEN unknown kind THEN render as `note` and emit a console warning in dev.
4. WHEN callouts setting is OFF THEN blockquote renders normally (no `[!]` parsing).

### P1: Footnotes ⭐ MVP

1. WHEN body contains `[^id]` THEN it SHALL render as a superscript link to `#fn-<id>`.
2. WHEN body contains `[^id]: text` (and matching reference exists) THEN a `<section class="footnotes">` is appended at the end of the rendered output with each definition.
3. WHEN reference has no definition THEN render `[^id]` literally (no link) and add data attribute for tooling.
4. WHEN definition has no reference THEN omit from output (no orphaned section).

### P1: Highlight ⭐ MVP

1. WHEN text contains `==content==` THEN it SHALL render as `<mark>content</mark>`.
2. WHEN escaped (`\==`) THEN render literally.
3. WHEN content spans line breaks THEN do not match (single-line only).

### P1: Parity ⭐ MVP

1. WHEN parity test runs THEN new fixtures (one per feature) SHALL pass on Rust and TS pipelines.
2. WHEN parity diverges THEN CI fails with diff.

### P2: Editor decorations

1. WHEN editing in CM6 THEN callout markers SHALL get a faint background. (Not a full live-preview rewrite — just decoration to hint the structure.)
2. WHEN editing footnote references THEN reference and definition lines get matching color via CM extension.

---

## Edge Cases

- WHEN a callout body contains another blockquote THEN nest correctly.
- WHEN footnote ID contains spaces THEN treat as invalid; render literal.
- WHEN highlight wraps an image (`==![[img.png]]==`) THEN do not parse — markdown image takes precedence.

---

## Requirement Traceability

| ID         | AC                            | Status  |
| ---------- | ----------------------------- | ------- |
| MDX-01     | Callout parsing               | Pending |
| MDX-02     | Callout known kinds           | Pending |
| MDX-03     | Callout unknown kind fallback | Pending |
| MDX-04     | Callout flag-off behavior     | Pending |
| MDX-05     | Footnote reference            | Pending |
| MDX-06     | Footnote definitions section  | Pending |
| MDX-07     | Footnote orphan handling      | Pending |
| MDX-08     | Highlight parsing             | Pending |
| MDX-09     | Highlight escape              | Pending |
| MDX-10     | Parity coverage               | Pending |
| MDX-11     | CM6 callout decoration        | Pending |
| MDX-12     | CM6 footnote decoration       | Pending |

## Success Criteria

- [ ] Snapshot fixtures: 6 (callouts × 3 kinds, footnote, highlight, mixed).
- [ ] Parity test extended and green.
- [ ] Bundle delta < 25 kB gzipped (TS); Rust binary delta < 200 KB.
