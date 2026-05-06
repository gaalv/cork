import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const noxeEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--color-noxe-paper, #faf7f0)",
    color: "var(--color-noxe-ink, #24211d)",
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "var(--color-noxe-accent, #7c5cff)",
    lineHeight: "1.7",
    padding: "1.5rem",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--color-noxe-muted, #7a736b)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-accent, #7c5cff) 7%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--color-noxe-ink, #24211d)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in oklab, var(--color-noxe-accent, #7c5cff) 24%, transparent)",
  },
});

export const noxeHighlightStyle = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading, color: "var(--color-noxe-ink, #24211d)", fontWeight: "700" },
    { tag: [tags.strong, tags.emphasis], color: "var(--color-noxe-ink, #24211d)", fontWeight: "600" },
    { tag: tags.link, color: "var(--color-noxe-accent, #7c5cff)", textDecoration: "underline" },
    { tag: tags.quote, color: "var(--color-noxe-muted, #7a736b)", fontStyle: "italic" },
    { tag: tags.monospace, color: "var(--color-noxe-code, #9a3412)" },
    { tag: tags.list, color: "var(--color-noxe-accent, #7c5cff)" },
  ]),
);
