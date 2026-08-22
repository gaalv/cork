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
import { toast } from "sonner";

import { useVaultStore } from "@/stores/vaultStore";
import { useShellStore } from "@/stores/shellStore";

const wikilinkRegex = /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;

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

/**
 * Resolve a wikilink target to a note.
 *
 * Title-only matching missed the folder-qualified form — `[[References/Cheat]]`
 * resolved to nothing even though the note existed, because its title is just
 * "Cheat". Fall back through the qualified forms before giving up.
 */
function resolveNote(target: string) {
  const notes = useVaultStore.getState().notes;
  const needle = target.toLowerCase().replace(/\.md$/, "");

  return (
    notes.find((n) => n.title.toLowerCase() === needle) ??
    notes.find((n) => `${n.folder}/${n.title}`.toLowerCase() === needle) ??
    notes.find((n) => n.path.toLowerCase().endsWith(`/${needle}.md`)) ??
    null
  );
}

/**
 * Click-to-follow.
 *
 * Cmd/Ctrl+Click always navigates. A plain click also navigates when the link
 * is *rendered* — that is, live preview is on and the caret is not already on
 * that line, so the brackets are concealed and the text reads as a link. Once
 * you are editing the line the markers are visible again and a plain click
 * goes back to placing the caret, which is what you want mid-edit.
 */
function wikilinkClickHandler(livePreview: boolean) {
  return EditorView.domEventHandlers({
    click(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const target = findWikilinkAt(view.state, pos);
      if (!target) return false;

      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) {
        if (!livePreview) return false;
        const line = view.state.doc.lineAt(pos);
        const caretOnLine = view.state.selection.ranges.some(
          (r) => r.to >= line.from && r.from <= line.to,
        );
        if (caretOnLine) return false; // editing this line — place the caret
      }

      const note = resolveNote(target);

      event.preventDefault();

      if (note) {
        useShellStore.getState().openNote(note.id);
        return true;
      }

      // A missing target used to be a silent no-op, which is indistinguishable
      // from a broken link — say so instead.
      toast.error(`No note titled "${target}"`);
      return true;
    },
  });
}

export function wikilinkExtension(livePreview: boolean) {
  return [wikilinkPlugin, wikilinkTheme, wikilinkClickHandler(livePreview)];
}
