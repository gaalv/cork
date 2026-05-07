import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const noxeEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--color-noxe-bg)",
    color: "var(--color-noxe-ink)",
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-content": {
    caretColor: "var(--color-noxe-accent)",
    lineHeight: "1.75",
    padding: "1.75rem 2rem 6rem",
    maxWidth: "780px",
    margin: "0 auto",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--color-noxe-subtle)",
    fontSize: "11px",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-accent) 6%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--color-noxe-ink)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-accent) 22%, transparent) !important",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--color-noxe-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-noxe-panel)",
    border: "1px solid var(--color-noxe-border)",
    borderRadius: "8px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.08)",
    color: "var(--color-noxe-ink)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-noxe-panel-2)",
    color: "var(--color-noxe-ink)",
  },
  ".cm-callout-line": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-accent) 8%, transparent)",
    borderLeft: "3px solid var(--color-noxe-accent)",
  },
  ".cm-footnote-def": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-muted) 8%, transparent)",
  },
  ".cm-footnote-ref": {
    color: "var(--color-noxe-accent)",
    fontSize: "0.82em",
    verticalAlign: "super",
  },
  ".cm-highlight-mark": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-warning, #f59e0b) 22%, transparent)",
    borderRadius: "0.2rem",
  },
  ".cm-md-bold": {
    fontWeight: "700",
  },
  ".cm-md-italic": {
    fontStyle: "italic",
  },
  ".cm-md-strike": {
    textDecoration: "line-through",
    textDecorationColor: "var(--color-noxe-muted)",
  },
  ".cm-md-code": {
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    backgroundColor: "color-mix(in oklab, var(--color-noxe-muted) 14%, transparent)",
    borderRadius: "0.25rem",
    padding: "0.05em 0.35em",
    fontSize: "0.9em",
  },
  ".cm-md-link": {
    color: "var(--color-noxe-accent)",
    cursor: "pointer",
  },
  ".cm-md-link:hover": {
    textDecoration: "underline",
  },
});

export const noxeHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, color: "var(--color-noxe-ink)", fontWeight: "700", fontSize: "1.6em", lineHeight: "1.2" },
    { tag: tags.heading2, color: "var(--color-noxe-ink)", fontWeight: "700", fontSize: "1.35em", lineHeight: "1.25" },
    { tag: tags.heading3, color: "var(--color-noxe-ink)", fontWeight: "700", fontSize: "1.15em" },
    { tag: tags.heading, color: "var(--color-noxe-ink)", fontWeight: "700" },
    { tag: tags.strong, color: "var(--color-noxe-ink)", fontWeight: "700" },
    { tag: tags.emphasis, color: "var(--color-noxe-ink)", fontStyle: "italic" },
    { tag: tags.link, color: "var(--color-noxe-accent)", textDecoration: "underline" },
    { tag: tags.quote, color: "var(--color-noxe-muted)", fontStyle: "italic" },
    { tag: tags.monospace, color: "var(--color-noxe-code, #9a3412)" },
    { tag: tags.list, color: "var(--color-noxe-accent)" },
  ]),
);
