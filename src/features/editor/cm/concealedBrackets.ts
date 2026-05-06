import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export const concealedBrackets = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildConcealDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildConcealDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildConcealDecorations(view: EditorView): DecorationSet {
  const cursor = view.state.selection.main.head;
  const decorations = [];
  const pattern = /\[\[[^\]]+\]\]/g;
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const match of text.matchAll(pattern)) {
      const start = from + (match.index ?? 0);
      const end = start + match[0].length;
      if (cursor >= start && cursor <= end) {
        continue;
      }
      decorations.push(Decoration.mark({ class: "cm-wikilink-bracket-hidden" }).range(start, start + 2));
      decorations.push(Decoration.mark({ class: "cm-wikilink-bracket-hidden" }).range(end - 2, end));
    }
  }
  return Decoration.set(decorations, true);
}
