import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export const headingSizes = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHeadingDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildHeadingDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildHeadingDecorations(view: EditorView): DecorationSet {
  const decorations = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const match = /^(#{1,3})\s/.exec(line.text);
      if (match) {
        decorations.push(Decoration.line({ class: `cm-heading-${match[1]?.length ?? 1}` }).range(line.from));
      }
      pos = line.to + 1;
      if (pos > view.state.doc.length) break;
    }
  }
  return Decoration.set(decorations, true);
}
