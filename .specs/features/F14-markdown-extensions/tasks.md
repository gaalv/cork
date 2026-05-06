# F14 — Markdown Extensions Tasks

```
T01 → { T02[P], T03[P], T04[P] } → T05 → T06 → T07 → T08
```

### T01: Fixtures
**What:** Add 8 markdown/html fixture pairs under `tests/fixtures/markdown/` covering callouts (3), footnotes (2), highlight (3).
**Where:** `tests/fixtures/markdown/`
**Depends on:** F08 done
**Requirement:** MDX-10
**Commit:** `test(markdown): fixtures for callouts, footnotes, highlight`

### T02: TS callouts plugin [P]
**What:** Implement `remarkCallouts` and rehype handler. Wire into `markdownPipeline.ts` behind `flags.callouts`.
**Where:** `src/features/preview/markdown/remarkCallouts.ts` + integration
**Depends on:** T01
**Requirement:** MDX-01..04
**Done when:** All callout fixtures pass on TS pipeline.
**Commit:** `feat(markdown): callouts (ts)`

### T03: TS footnotes wiring [P]
**What:** Confirm `remark-gfm` footnote support; if class names differ, post-process to `class="footnotes"`. Add toggle.
**Where:** `markdownPipeline.ts`
**Depends on:** T01
**Requirement:** MDX-05..07
**Commit:** `feat(markdown): footnotes (ts)`

### T04: TS highlight plugin [P]
**What:** `remarkHighlight` over text nodes; obeys flag.
**Where:** `src/features/preview/markdown/remarkHighlight.ts`
**Depends on:** T01
**Requirement:** MDX-08, 09
**Commit:** `feat(markdown): highlight (ts)`

### T05: Rust callouts adapter
**What:** Iterator adapter on pulldown-cmark events; unit tests in Rust.
**Where:** `src-tauri/src/markdown/callouts.rs` (or `assets/preview` module per F08 decision)
**Depends on:** T02
**Requirement:** MDX-01..04
**Done when:** Unit tests for nested + unknown kind + flag-off; snapshot matches TS output for fixtures.
**Commit:** `feat(markdown): callouts (rust)`

### T06: Rust footnotes + highlight
**What:** Enable `Options::ENABLE_FOOTNOTES`; implement `highlight::transform`.
**Where:** `src-tauri/src/markdown/highlight.rs`
**Depends on:** T03, T04
**Requirement:** MDX-05..09
**Commit:** `feat(markdown): footnotes + highlight (rust)`

### T07: Parity test extension
**What:** Update parity runner (F08-T?? renderer-parity) to include new fixtures; assert byte-identical (after the existing whitespace normalization).
**Where:** `tests/integration/markdown-parity.spec.ts`
**Depends on:** T05, T06
**Requirement:** MDX-10
**Done when:** CI green for parity job with all fixtures.
**Commit:** `test(markdown): parity for new extensions`

### T08: CM6 decoration extensions
**What:** `calloutHintExtension`, `footnoteDefExtension`. Add to editor extensions list; tokens use Tailwind classes.
**Where:** `src/features/editor/cm/{calloutHint,footnoteDef}.ts`
**Depends on:** T02
**Requirement:** MDX-11, 12
**Commit:** `feat(editor): decorations for callouts and footnotes`
