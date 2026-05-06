# F14 — Markdown Extensions Design

## Architecture

We add three extensions on both pipelines:

```
TS (unified):
  remarkParse → remarkGfm → remarkCallouts (custom) → remarkFootnotes → remarkHighlight (custom)
                                                       (existing pkg)
Rust (pulldown-cmark):
  pulldown_cmark::Parser with Options::ENABLE_FOOTNOTES
  + custom event-stream rewriter for Callouts and Highlight
```

## TS pipeline

### remarkCallouts (custom)
Visit `blockquote` nodes whose first paragraph child's first text node matches `^\[!(?<kind>\w+)\](?<title>.*)$`. Transform into custom `callout` mdast node, then use a hast handler in remark-rehype to emit:

```html
<aside class="callout callout-{kind}" data-kind="{kind}">
  <header><svg class="callout-icon" .../>{title || defaultLabel(kind)}</header>
  <div class="callout-body">{rest}</div>
</aside>
```

### remark-footnotes
Use `remark-gfm` (already supports footnotes) → set `singleTilde: false` etc. Already works; just ensure rehype-stringify emits the section with `class="footnotes"`.

### remarkHighlight (custom)
Tokenize `==(?<content>[^=\n]+)==` in text nodes; replace with `mark` mdast extension. Skip when escaped.

## Rust pipeline

```rs
let mut opts = pulldown_cmark::Options::empty();
opts.insert(Options::ENABLE_TABLES | Options::ENABLE_TASKLISTS | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_FOOTNOTES);
let parser = pulldown_cmark::Parser::new_ext(&src, opts);
let parser = callouts::transform(parser);
let parser = highlight::transform(parser);
```

`callouts::transform` is an iterator adapter that detects `Event::Start(Tag::BlockQuote)` followed by a paragraph whose initial text matches the callout pattern, and emits a synthetic raw HTML `Event::Html("<aside ...>")` open + close tags. Body events flow through unchanged.

`highlight::transform` rewrites `Event::Text` containing `==..==` into a stream of Text + `Html("<mark>")` + Text + `Html("</mark>")`.

## Settings flags consumed

```ts
const flags = {
  callouts: settingsBridge.get('markdown.callouts'),
  footnotes: settingsBridge.get('markdown.footnotes'),
  highlight: settingsBridge.get('markdown.highlight'),
};
preview.render(md, flags);
```

Same flags forwarded to Rust via `preview.render` IPC args (Rust path also used for indexing? — only if needed; see F08).

## CM6 decorations

`calloutHintExtension`: regex on visible ranges; add line decoration with class `cm-callout-line` when matching `[!kind]` header. Footnote def lines: `^\[\^[^\]]+\]:` get class `cm-footnote-def`.

## Parity gate updates

Add fixtures under `tests/fixtures/markdown/`:
- `callout-note.md`, `callout-warning.md`, `callout-unknown.md`
- `footnote-basic.md`, `footnote-orphan.md`
- `highlight-basic.md`, `highlight-escape.md`, `highlight-mixed.md`

Each `.md` paired with expected `.html`. Parity runner already iterates the directory.

## Risks

- Pulldown-cmark event-stream adapters can desync if blockquote contains nested structure → write extensive unit tests, not just snapshots.
- Footnotes ordering differs slightly between unified + pulldown — normalize in snapshot post-processor (sort by id).
- Custom remark plugins have their own micromark grammar in newer versions; we use AST visitor approach to avoid micromark complexity.
