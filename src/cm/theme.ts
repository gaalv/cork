/**
 * CodeMirror theme — uses Cork CSS custom properties so it
 * automatically adapts to light/dark via data-theme attribute.
 *
 * @see F05 — Editor spec
 * @see F15 — Theme Switching
 */

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

const themeSpec = {
  "&": {
    // Driven by --editor-font-size / --editor-line-height, which fontRuntime
    // writes from settings. A literal value here silently overrode the
    // container's inherited size and made the Font size setting a no-op.
    fontSize: "var(--editor-font-size)",
    fontFamily: "var(--font-editor)",
    color: "var(--color-cork-ink)",
    backgroundColor: "transparent",
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
    scrollbarWidth: "none",
    // The scroller owns line-height so .cm-content children inherit it.
    lineHeight: "var(--editor-line-height)",
    fontFamily: "inherit",
    "&::-webkit-scrollbar": { display: "none" },
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    caretColor: "var(--color-cork-accent)",
    padding: "40px 0 45vh",
    // Match the preview's antialiased rendering (CM doesn't inherit it).
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    // Break long unbreakable tokens when line wrap is on. `break-word` keeps
    // normal words intact; `anywhere` was chopping mid-word unnecessarily.
    overflowWrap: "break-word",
  },
  ".cm-line": {
    // Longhand on purpose: the `padding` shorthand also resets top/bottom, and
    // theme rules outrank baseTheme ones — which silently killed the block
    // padding that livePreview puts on the first/last line of quotes, callouts
    // and code fences.
    paddingRight: "2px",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-cork-accent)",
    borderLeftWidth: "2px",
  },
  // Vim fat cursor — override the default red with accent color
  ".cm-fat-cursor": {
    background: "var(--color-cork-accent) !important",
    color: "var(--color-cork-primary-foreground) !important",
    outline: "none !important",
  },
  "&:not(.cm-focused) .cm-fat-cursor": {
    background: "none !important",
    outline: "1px solid var(--color-cork-accent) !important",
  },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground":
    {
      backgroundColor: "var(--color-cork-accent-soft)",
    },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--color-cork-subtle)",
    border: "none",
    paddingRight: "8px",
    fontFamily: "var(--font-mono)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--color-cork-muted)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    fontSize: "0.8em",
    minWidth: "32px",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--color-cork-accent-soft)",
    outline: "1px solid var(--color-cork-accent)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-cork-panel-2)",
    border: "1px solid var(--color-cork-border)",
    color: "var(--color-cork-muted)",
    borderRadius: "4px",
    padding: "0 4px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-cork-panel)",
    border: "1px solid var(--color-cork-border)",
    borderRadius: "10px",
    boxShadow: "var(--shadow-lg)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete": {
    minWidth: "220px",
  },
  ".cm-tooltip-autocomplete ul": {
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    padding: "4px",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "6px 10px",
    borderRadius: "6px",
    lineHeight: "1.4",
    color: "var(--color-cork-ink)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--color-cork-accent-soft)",
    color: "var(--color-cork-ink)",
  },
  ".cm-completionLabel": {
    fontWeight: "500",
  },
  ".cm-completionDetail": {
    fontStyle: "normal",
    color: "var(--color-cork-muted)",
    fontSize: "11px",
    marginLeft: "8px",
  },
  ".cm-panels": {
    backgroundColor: "var(--color-cork-panel)",
    borderTop: "1px solid var(--color-cork-border)",
    color: "var(--color-cork-ink)",
    fontFamily: "var(--font-sans)",
  },
  ".cm-panel.cm-search": {
    padding: "8px 12px",
  },
  ".cm-panel.cm-search input, .cm-panel.cm-search button": {
    backgroundColor: "var(--color-cork-panel-2)",
    color: "var(--color-cork-ink)",
    border: "1px solid var(--color-cork-border)",
    borderRadius: "6px",
    padding: "2px 6px",
  },
};

/**
 * The `dark` flag drives CodeMirror's own `&dark` base-theme rules (selection
 * layer, panels, tooltips). It was pinned to `false`, so dark mode inherited
 * light-mode defaults for anything not covered by our own rules above.
 */
export function corkEditorTheme(dark: boolean) {
  return EditorView.theme(themeSpec, { dark });
}

const corkHighlightStyle = HighlightStyle.define([
  // Sizes/weights mirror the preview headings (.cork-preview) so edit and
  // preview render the same.
  { tag: tags.heading1, fontWeight: "650", fontSize: "1.6em", lineHeight: "1.3" },
  { tag: tags.heading2, fontWeight: "650", fontSize: "1.35em", lineHeight: "1.3" },
  { tag: tags.heading3, fontWeight: "650", fontSize: "1.15em", lineHeight: "1.35" },
  { tag: tags.heading4, fontWeight: "650", fontSize: "1em" },
  { tag: tags.heading5, fontWeight: "650", fontSize: "0.95em" },
  { tag: tags.heading6, fontWeight: "650", fontSize: "0.9em", color: "var(--color-cork-muted)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--color-cork-muted)" },
  { tag: tags.link, color: "var(--color-cork-accent)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--color-cork-accent)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em" },
  { tag: tags.content, color: "var(--color-cork-ink)" },
  { tag: tags.quote, color: "var(--color-cork-muted)", fontStyle: "italic" },

  // --- Code tokens ---------------------------------------------------------
  // Previously most of these collapsed onto two greys, so fenced code blocks
  // rendered essentially monochrome. They now use the --syn-* palette, which
  // index.css redefines per theme.
  { tag: [tags.keyword, tags.moduleKeyword, tags.self, tags.null], color: "var(--syn-keyword)" },
  { tag: [tags.controlKeyword, tags.operatorKeyword], color: "var(--syn-keyword)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "var(--syn-string)" },
  { tag: [tags.number, tags.bool, tags.atom], color: "var(--syn-number)" },
  {
    tag: [tags.constant(tags.variableName), tags.standard(tags.name)],
    color: "var(--syn-constant)",
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: "var(--syn-comment)",
    fontStyle: "italic",
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.labelName],
    color: "var(--syn-function)",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace, tags.tagName],
    color: "var(--syn-type)",
  },
  {
    tag: [tags.definition(tags.variableName), tags.propertyName, tags.attributeName],
    color: "var(--syn-variable)",
  },
  { tag: [tags.operator, tags.derefOperator, tags.compareOperator], color: "var(--syn-operator)" },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: "var(--syn-punctuation)" },
  { tag: tags.escape, color: "var(--syn-constant)" },
  { tag: tags.invalid, color: "var(--syn-invalid)" },

  // Markdown structural marks (visible only when the caret is on the line).
  { tag: tags.processingInstruction, color: "var(--color-cork-subtle)" },
  { tag: tags.meta, color: "var(--color-cork-subtle)" },
]);

export const corkHighlighting = syntaxHighlighting(corkHighlightStyle);
