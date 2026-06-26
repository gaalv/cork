/**
 * CodeMirror extension for clickable wikilinks.
 *
 * Decorates [[wikilink]] syntax with link styling and
 * navigates to the target note on Cmd/Ctrl+Click.
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

import { useVaultStore } from "@/features/vault/state/vaultStore";
import { useShellStore } from "@/features/shell/state/shellStore";

const wikilinkRegex = /\[\[([^\]\[|]+?)(?:\|([^\]\[]+?))?\]\]/g;

const linkMark = Decoration.mark({ class: "cm-cork-wikilink" });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    let match;
    wikilinkRegex.lastIndex = 0;
    while ((match = wikilinkRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      builder.add(start, end, linkMark);
    }
  }
  return builder.finish();
}

const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const wikilinkTheme = EditorView.baseTheme({
  ".cm-cork-wikilink": {
    color: "var(--color-cork-accent)",
    textDecoration: "underline",
    textDecorationColor: "color-mix(in srgb, var(--color-cork-accent) 40%, transparent)",
    textUnderlineOffset: "2px",
    cursor: "pointer",
  },
});

function findWikilinkAt(state: EditorView["state"], pos: number): string | null {
  const line = state.doc.lineAt(pos);
  const text = line.text;
  const lineOffset = pos - line.from;
  wikilinkRegex.lastIndex = 0;
  let match;
  while ((match = wikilinkRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (lineOffset >= start && lineOffset <= end) {
      // Return the display text (alias if present, otherwise target)
      return match[1];
    }
  }
  return null;
}

const wikilinkClickHandler = EditorView.domEventHandlers({
  click(event, view) {
    if (!event.metaKey && !event.ctrlKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const target = findWikilinkAt(view.state, pos);
    if (!target) return false;

    // Find the note by title
    const notes = useVaultStore.getState().notes;
    const note = notes.find(
      (n) => n.title.toLowerCase() === target.toLowerCase(),
    );

    if (note) {
      event.preventDefault();
      useShellStore.getState().openNote(note.id);
      return true;
    }

    return false;
  },
});

export function wikilinkExtension() {
  return [wikilinkPlugin, wikilinkTheme, wikilinkClickHandler];
}
