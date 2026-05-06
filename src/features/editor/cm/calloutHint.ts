import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export const calloutHintExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCalloutDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCalloutDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildCalloutDecorations(view: EditorView): DecorationSet {
  const decorations = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      if (/^>\s*\[![A-Za-z][\w-]*\]/.test(line.text)) {
        decorations.push(Decoration.line({ class: "cm-callout-line" }).range(line.from));
      }
      pos = line.to + 1;
      if (pos > view.state.doc.length) break;
    }
  }
  return Decoration.set(decorations, true);
}
