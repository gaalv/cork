# F16 — Live Preview Editor — Design

## Architecture summary

```
┌────────────────────────────────────────┐
│ NoteView (single pane)                 │
│  ┌──────────────────────────────────┐  │
│  │ <Editor />                       │  │
│  │   CodeMirror 6                   │  │
│  │   + createEditorExtensions()     │  │
│  │     ├─ markdown() (Lezer parser) │  │
│  │     ├─ syntaxHighlighting        │  │
│  │     ├─ headingSizes              │  │
│  │     ├─ concealedBrackets         │  │
│  │     ├─ liveMarkdownDecorations  ◄┼──┐ NEW: hides ** _ ~ ` link-syntax
│  │     ├─ liveLinkClickHandler     ◄┼──┤ NEW: ⌘+click opens URL
│  │     ├─ slashMenu, wikilink, tag │  │
│  │     ├─ search, theme, drop      │  │
│  │     └─ liveModeFacet            ◄┼──┤ NEW: toggles concealment on/off
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

`Preview.tsx` and `EditorPreviewSplit.tsx` remain in the codebase but are no longer mounted from `NoteView`. They become dead weight that a future "preview window" feature can re-mount.

## New modules

### 1. `src/features/editor/cm/liveMarkdownDecorations.ts`

A single ViewPlugin that emits all the inline conceal+style decorations:

```ts
export const liveMarkdownDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view) { this.decorations = build(view); }
  update(u) {
    if (u.docChanged || u.selectionSet || u.viewportChanged ||
        u.startState.facet(liveModeFacet) !== u.state.facet(liveModeFacet)) {
      this.decorations = build(u.view);
    }
  }
}, { decorations: p => p.decorations });
```

`build(view)`:

1. If `liveMode` facet is `"source"` → return empty set.
2. Walk visible ranges. For each line, get its `syntaxTree(state)` slice.
3. For each Lezer node of types `Emphasis`, `StrongEmphasis`, `Strikethrough`, `InlineCode`, `Link`, **skip** if any ancestor is `FencedCode` or `CodeBlock` (Lezer node types from `@codemirror/lang-markdown`).
4. For each surviving inline mark range:
   - If caret ∈ `[from, to]` → no concealment, but still apply the rendered class (e.g. `cm-md-bold`) so the user sees the formatting WHILE inside.
   - Else → conceal the markers (`Decoration.replace` over the `**`/`*`/`_`/`~~`/`` ` `` / `(url)` portions) and apply the rendered class to the inner content.
5. For headings: hide the `#…#␣` marker prefix when caret is not on the line. Heading line classes are already applied by `headingSizes` (kept).

CSS classes used:

| Class            | Purpose                                       |
| ---------------- | --------------------------------------------- |
| `cm-md-bold`     | `font-weight: 700`                            |
| `cm-md-italic`   | `font-style: italic`                          |
| `cm-md-strike`   | `text-decoration: line-through`               |
| `cm-md-code`     | inline-code monospace + chip background       |
| `cm-md-link`     | accent color, underline on hover              |
| `cm-md-hidden`   | `display: none` (used inside `Decoration.replace`) |

These will be added to `src/features/editor/cm/theme.ts` (`noxeEditorTheme`) so they automatically pick up the dark-mode tokens.

### 2. `src/features/editor/cm/liveModeFacet.ts`

```ts
export const liveModeFacet = Facet.define<"live" | "source", "live" | "source">({
  combine: (values) => values[0] ?? "live",
});

export function setLiveMode(view: EditorView, mode: "live" | "source") {
  view.dispatch({ effects: StateEffect.reconfigure.of([
    /* the same extensions, but with liveModeFacet.of(mode) */
  ]) });
}
```

Facets compose cleanly into `createEditorExtensions(...)` and avoid passing React state through props.

### 3. `src/features/editor/cm/liveLinkClick.ts`

A small `EditorView.domEventHandlers` extension:

```ts
export const liveLinkClick = EditorView.domEventHandlers({
  click(event, view) {
    if (!event.metaKey && !event.ctrlKey) return;
    const target = event.target as HTMLElement;
    const a = target.closest('[data-md-href]');
    if (!a) return;
    const href = a.getAttribute('data-md-href');
    if (href) { event.preventDefault(); openUrl(href); }
  },
});
```

(The link decoration sets `data-md-href={url}` on its rendered range so that this handler can pick it up.)

### 4. `src/features/note-view/state/noteViewStore.ts` (extended)

Add a per-session map keyed by `noteId`:

```ts
liveMode: Record<string, "live" | "source">; // default "live"
toggleLiveMode(noteId: string): void;
getLiveMode(noteId: string): "live" | "source";
```

## Component changes

### `EditorPreviewSplit.tsx` → unwired

`NoteView.tsx` will render `<Editor />` directly (no split). The file stays for future reuse.

### `Editor.tsx`

- Accept `liveMode: "live" | "source"` prop (or read it from `useNoteViewStore` keyed by `activeNoteId`).
- Pass it through `createEditorExtensions({ ..., liveMode })`.
- Existing reconfigure-on-settings effect handles facet changes the same way.

### `extensions.ts`

`createEditorExtensions` adds:

```ts
liveModeFacet.of(options.liveMode ?? "live"),
liveMarkdownDecorations,
liveLinkClick,
```

### `useShortcuts.ts` / `EditorPreviewSplit.tsx`

Move the ⌘. handler out of `EditorPreviewSplit` (which is going away) and into `Editor` or `NoteView` so it toggles `liveMode` for the active note.

## Testing strategy

Unit tests (Vitest + jsdom) for `liveMarkdownDecorations`:

- Builds a `EditorView` with a doc, runs the plugin, then asserts `view.contentDOM.innerHTML` contains/doesn't contain the marker characters.
- Helper `withCaret(at)` to set selection.
- Cases: heading marker hidden/shown, bold/italic/strike/code marker hidden/shown, link source hidden/label visible, source-mode disables all.

Integration test in `NoteView.test.tsx`:

- Render NoteView with a fixture buffer.
- Assert `<aside aria-label="Markdown preview pane">` is no longer in the DOM.
- Toggle live mode via ⌘. and assert the editor still has focus.

## Knowledge verification

- Step 1 (codebase): existing `concealedBrackets` and `headingSizes` ViewPlugins prove the pattern works in this repo.
- Step 2 (project docs): no design doc covers this; we are establishing it.
- Step 3 (Context7/web): the Obsidian Live Preview implementation uses the same CodeMirror 6 decoration-on-syntax-tree approach. Code patterns referenced from `@codemirror/lang-markdown` Lezer node names (`StrongEmphasis`, `Emphasis`, `InlineCode`, `Link`, `FencedCode`) are documented in the official `@codemirror/lang-markdown` package.

## Rollback plan

The split layout is removed but the source files (`EditorPreviewSplit.tsx`, `Preview.tsx`) are not deleted. A revert of the wiring change in `NoteView.tsx` plus the extensions array brings the split pane back. Decorations are additive and harmless even if not rendered.
