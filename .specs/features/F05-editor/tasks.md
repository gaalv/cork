# F05 — Editor Tasks

```
T01 → { T02[P], T03[P] } → T04 → T05 → T06 → T07 → T08 →
       { T09[P], T10[P], T11[P], T12[P] } → T13 → T14 → T15 → T16 → T17
```

### T01: Install editor + preview deps
**What:** `pnpm add @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/autocomplete @codemirror/commands @lezer/markdown react-markdown remark-gfm remark-math rehype-katex katex shiki mermaid`.
**Where:** `package.json`
**Depends on:** F04
**Done when:** Typecheck passes.
**Commit:** `chore(editor): install codemirror + preview deps`

### T02: editorStore [P]
**What:** Zustand store per design (buffers map, activeNoteId, openBuffer, updateBody, markSaved, setConflict, resolveConflict).
**Where:** `src/features/editor/state/editorStore.ts` + tests
**Depends on:** T01
**Requirement:** EDITOR-01..06, 21
**Done when:** Tests cover load → edit → save → conflict.
**Commit:** `feat(editor): zustand buffer store`

### T03: Theme + extensions [P]
**What:** `cm/theme.ts` reads CSS variables from `@theme`. `cm/extensions.ts` returns the standard extension array.
**Where:** `src/features/editor/cm/{theme,extensions}.ts`
**Depends on:** T01
**Requirement:** EDITOR-07, 08
**Done when:** Snapshot test renders themed CM in jsdom.
**Commit:** `feat(editor): codemirror theme + base extensions`

### T04: Editor.tsx
**What:** React wrapper that mounts EditorView, wires `editorStore.updateBody` on doc changes, sets initial doc on `activeNoteId` change. Memoized; one EditorView per buffer.
**Where:** `src/features/editor/ui/Editor.tsx`
**Depends on:** T02, T03
**Requirement:** EDITOR-01, 02
**Done when:** Component test mounts and types into editor; store updates.
**Commit:** `feat(editor): editor component`

### T05: useAutoSave
**What:** Hook subscribing to `editorStore` with 500 ms debounce per buffer; calls `client.notes.save({ ...expected_mtime })`. Handles Conflict.
**Where:** `src/features/editor/hooks/useAutoSave.ts` + test (with mocked client + fake timers)
**Depends on:** T02
**Requirement:** EDITOR-03, 04, 05, 06
**Done when:** Tests cover debounce, in-flight queueing, conflict.
**Commit:** `feat(editor): auto-save hook`

### T06: useExternalReconciler
**What:** Hook subscribing to `vault.fileChanged` for active buffer; reload or set conflict based on `source` and `dirty`.
**Where:** `src/features/editor/hooks/useExternalReconciler.ts` + test
**Depends on:** T02
**Requirement:** EDITOR-21
**Done when:** Tests cover both branches.
**Commit:** `feat(editor): external reconciler`

### T07: ConflictBanner + SaveIndicator
**Where:** `src/features/editor/ui/{ConflictBanner,SaveIndicator}.tsx`
**Depends on:** T02
**Requirement:** EDITOR-04, 05
**Done when:** RTL: clicking "Reload" or "Keep mine" calls store actions.
**Commit:** `feat(editor): save indicator + conflict banner`

### T08: Preview + plugin chain
**What:** `Preview.tsx` renders react-markdown with the plugin chain. Uses remark-wikilink (custom). Heading components emit ids for outline. Task list checkboxes are interactive (call store).
**Where:** `src/features/editor/ui/Preview.tsx`, `src/features/editor/preview/plugins.ts`, custom `remarkWikilink.ts`
**Depends on:** T01
**Requirement:** EDITOR-10, 11, 12, 16, 20
**Done when:** Snapshot tests for headings/lists/wikilinks/tasks.
**Commit:** `feat(editor): preview with remark/rehype chain`

### T09: shikiHighlighter [P]
**What:** Lazy-loaded Shiki singleton with `vitesse-light` theme. Cached. rehype-shiki integration.
**Where:** `src/features/editor/preview/shikiHighlighter.ts`
**Depends on:** T08
**Requirement:** EDITOR-13
**Done when:** Tests render `js`, `ts`, `rust`, `bash` blocks.
**Commit:** `feat(editor): shiki integration`

### T10: katexRenderer [P]
**What:** Wire `remark-math` + `rehype-katex` and import KaTeX CSS once.
**Where:** `src/features/editor/preview/katexRenderer.ts`, `src/index.css` import
**Depends on:** T08
**Requirement:** EDITOR-14
**Done when:** `$x^2$` renders to span with class `katex`.
**Commit:** `feat(editor): katex math support`

### T11: mermaidRenderer [P]
**What:** Custom rehype plugin replacing `<code class="language-mermaid">` with a div; React component dynamically imports `mermaid` and renders SVG. Errors fall back to source text.
**Where:** `src/features/editor/preview/mermaidRenderer.tsx`
**Depends on:** T08
**Requirement:** EDITOR-15
**Done when:** Test renders a flowchart fixture.
**Commit:** `feat(editor): mermaid diagram support`

### T12: concealedBrackets + headingSizes CM extensions [P]
**Where:** `src/features/editor/cm/concealedBrackets.ts`, `headingSizes.ts`
**Depends on:** T03
**Requirement:** EDITOR-08, 09
**Done when:** Decorations applied; cursor-based reveal works.
**Commit:** `feat(editor): concealed brackets + heading sizes`

### T13: wikilinkAutocomplete CM extension
**What:** Activates on `[[`. Source from `indexStore.notes` + `notes.recent`. Up to 8 suggestions, fuzzy. Inserts `[[Title]]`. Enter without match → literal.
**Where:** `src/features/editor/cm/wikilinkAutocomplete.ts` + test
**Depends on:** T04
**Requirement:** EDITOR-17
**Done when:** Test simulates keystrokes; popover shows; selection inserts.
**Commit:** `feat(editor): wikilink autocomplete`

### T14: tagAutocomplete CM extension
**Where:** `src/features/editor/cm/tagAutocomplete.ts` + test
**Depends on:** T04
**Requirement:** EDITOR-18
**Done when:** Same shape of test, source from `tags.list()`.
**Commit:** `feat(editor): tag autocomplete`

### T15: Slash menu
**Where:** `src/features/editor/cm/slashMenu.ts` + test
**Depends on:** T04
**Requirement:** EDITOR-19
**Done when:** Test inserts a code block via menu pick.
**Commit:** `feat(editor): slash menu`

### T16: EditorPreviewSplit
**What:** Composes Editor + Preview side-by-side with toggle (⌘.) and synced scrolling (heading-based mapping). Adds large-file degraded mode flag (>1 MB → disables mermaid/katex chunks).
**Where:** `src/features/editor/ui/EditorPreviewSplit.tsx`
**Depends on:** T04, T08
**Requirement:** EDITOR-10, 11, 22
**Done when:** Component test toggles preview, syncs scroll for fixture.
**Commit:** `feat(editor): split + sync scroll`

### T17: Chaos save test (Playwright)
**What:** Run a Node child that randomly modifies the open file 50 times while UI types 100 chars; assert no data loss in final state.
**Where:** `tests/e2e/editor/chaos-save.spec.ts`
**Depends on:** T05, T06
**Requirement:** success criterion 3
**Done when:** Spec passes deterministically (seeded RNG).
**Commit:** `test(editor): chaos save under external mods`

### T18: CM6 search/find-replace
**What:** Wire `@codemirror/search` extension; ⌘F opens panel; ⌘⇧F opens with replace input. Esc restores cursor.
**Where:** `src/features/editor/cm/searchExtension.ts`
**Depends on:** T04
**Requirement:** added by F13 (SETTINGS-05/06) but lives in editor module
**Done when:** RTL test fires ⌘F → panel visible.
**Commit:** `feat(editor): in-note find and replace`
