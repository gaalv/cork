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

export const corkEditorTheme = EditorView.theme(
  {
    "&": {
      fontSize: "14px",
      fontFamily: "var(--font-mono)",
      color: "var(--color-cork-ink)",
      backgroundColor: "transparent",
      height: "100%",
    },
    ".cm-scroller": {
      overflow: "auto",
      scrollbarWidth: "none",
      "&::-webkit-scrollbar": { display: "none" },
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-content": {
      caretColor: "var(--color-cork-accent)",
      padding: "40px 0",
      lineHeight: "1.7",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-cork-accent)",
      borderLeftWidth: "2px",
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
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-cork-muted)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      fontSize: "12px",
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
      borderRadius: "8px",
      boxShadow: "var(--shadow-md)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--color-cork-accent-soft)",
      color: "var(--color-cork-ink)",
    },
    ".cm-panels": {
      backgroundColor: "var(--color-cork-panel)",
      borderTop: "1px solid var(--color-cork-border)",
    },
    ".cm-panel.cm-search": {
      padding: "8px 12px",
    },
  },
  { dark: false },
);

const corkHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "700", fontSize: "1.5em", lineHeight: "1.3" },
  { tag: tags.heading2, fontWeight: "700", fontSize: "1.3em", lineHeight: "1.3" },
  { tag: tags.heading3, fontWeight: "600", fontSize: "1.15em", lineHeight: "1.4" },
  { tag: tags.heading4, fontWeight: "600", fontSize: "1em" },
  { tag: tags.heading5, fontWeight: "600", fontSize: "0.95em" },
  { tag: tags.heading6, fontWeight: "600", fontSize: "0.9em", color: "var(--color-cork-muted)" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--color-cork-muted)" },
  { tag: tags.link, color: "var(--color-cork-accent)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--color-cork-accent)" },
  { tag: tags.monospace, fontFamily: "var(--font-mono)", fontSize: "0.9em" },
  {
    tag: tags.content,
    color: "var(--color-cork-ink)",
  },
  {
    tag: [tags.processingInstruction, tags.inserted],
    color: "var(--color-cork-tag)",
  },
  {
    tag: tags.meta,
    color: "var(--color-cork-muted)",
  },
  {
    tag: tags.comment,
    color: "var(--color-cork-subtle)",
    fontStyle: "italic",
  },
  {
    tag: [tags.keyword, tags.operator],
    color: "var(--color-cork-muted)",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--color-cork-success)",
  },
  {
    tag: tags.number,
    color: "var(--color-cork-muted)",
  },
  {
    tag: tags.bool,
    color: "var(--color-cork-muted)",
  },
  {
    tag: [tags.definition(tags.variableName), tags.function(tags.variableName)],
    color: "#6b6660",
  },
  {
    tag: tags.typeName,
    color: "#8a857d",
  },
  {
    tag: tags.quote,
    color: "var(--color-cork-muted)",
    fontStyle: "italic",
  },
]);

export const corkHighlighting = syntaxHighlighting(corkHighlightStyle);
