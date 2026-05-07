import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";

import { liveModeFacet } from "./liveModeFacet";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { Range } from "@codemirror/state";

class HiddenWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "none";
    return span;
  }
}

const HIDDEN = new HiddenWidget();

export const headingSizes = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildHeadingDecorations(view);
    }

    update(update: ViewUpdate) {
      const modeChanged =
        update.startState.facet(liveModeFacet) !== update.state.facet(liveModeFacet);
      if (update.docChanged || update.selectionSet || update.viewportChanged || modeChanged) {
        this.decorations = buildHeadingDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildHeadingDecorations(view: EditorView): DecorationSet {
  const live = view.state.facet(liveModeFacet) === "live";
  const cursor = view.state.selection.main.head;
  const decorations: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      const match = /^(#{1,3})(\s+)/.exec(line.text);
      if (match) {
        decorations.push(Decoration.line({ class: `cm-heading-${match[1]?.length ?? 1}` }).range(line.from));
        const caretOnLine = cursor >= line.from && cursor <= line.to;
        if (live && !caretOnLine) {
          const markerEnd = line.from + (match[1]?.length ?? 0) + (match[2]?.length ?? 0);
          decorations.push(Decoration.replace({ widget: HIDDEN }).range(line.from, markerEnd));
        }
      }
      pos = line.to + 1;
      if (pos > view.state.doc.length) break;
    }
  }
  return Decoration.set(decorations, true);
}
