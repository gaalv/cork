import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export const footnoteDefExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFootnoteDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildFootnoteDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildFootnoteDecorations(view: EditorView): DecorationSet {
  const decorations = [];
  const referencePattern = /\[\^[A-Za-z0-9_-]+\]/g;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (/^\[\^[A-Za-z0-9_-]+\]:/.test(line.text)) {
        decorations.push(Decoration.line({ class: "cm-footnote-def" }).range(line.from));
      }
      for (const match of line.text.matchAll(referencePattern)) {
        const start = line.from + (match.index ?? 0);
        decorations.push(Decoration.mark({ class: "cm-footnote-ref" }).range(start, start + match[0].length));
      }
      pos = line.to + 1;
      if (pos > view.state.doc.length) break;
    }
  }
  return Decoration.set(decorations, true);
}
