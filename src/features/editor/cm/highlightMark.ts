import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export const highlightMarkExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHighlightDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildHighlightDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildHighlightDecorations(view: EditorView): DecorationSet {
  const decorations = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    let cursor = 0;
    while (cursor < text.length) {
      const start = text.indexOf("==", cursor);
      if (start === -1) break;
      if (text[start - 1] === "\\") {
        const escapedEnd = text.indexOf("==", start + 2);
        cursor = escapedEnd === -1 ? start + 2 : escapedEnd + 2;
        continue;
      }
      const end = text.indexOf("==", start + 2);
      if (end === -1) break;
      const content = text.slice(start + 2, end);
      if (content && !content.includes("\n") && !content.startsWith("![") && !content.startsWith("![[")) {
        decorations.push(Decoration.mark({ class: "cm-highlight-mark" }).range(from + start, from + end + 2));
      }
      cursor = end + 2;
    }
  }
  return Decoration.set(decorations, true);
}
