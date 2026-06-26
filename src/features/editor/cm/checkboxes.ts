/**
 * Interactive task checkboxes for CodeMirror 6.
 *
 * Replaces `- [ ]` and `- [x]` with clickable checkbox widgets
 * that toggle the check state in the document.
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { type Range } from "@codemirror/state";

const TASK_RE = /^(\s*[-*+]\s)\[([ xX])\]/;

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) {
    super();
  }

  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.pos === other.pos;
  }

  toDOM() {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cork-cm-checkbox";
    input.setAttribute("aria-label", this.checked ? "Mark as incomplete" : "Mark as complete");
    return input;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc;

    for (let i = text.lineAt(from).number; i <= text.lineAt(to).number; i++) {
      const line = text.line(i);
      const match = TASK_RE.exec(line.text);
      if (match) {
        const bracketStart = line.from + match[1].length;
        const bracketEnd = bracketStart + 3; // [ ] or [x]
        const checked = match[2].toLowerCase() === "x";

        decorations.push(
          Decoration.replace({
            widget: new CheckboxWidget(checked, bracketStart),
          }).range(bracketStart, bracketEnd),
        );
      }
    }
  }

  return Decoration.set(decorations);
}

export function checkboxExtension() {
  return [
    ViewPlugin.fromClass(
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
      {
        decorations: (v) => v.decorations,
        eventHandlers: {
          mousedown(event: MouseEvent, view: EditorView) {
            const target = event.target as HTMLElement;
            if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") {
              return false;
            }

            event.preventDefault();

            const pos = view.posAtDOM(target);
            const line = view.state.doc.lineAt(pos);
            const match = TASK_RE.exec(line.text);
            if (!match) return false;

            const bracketStart = line.from + match[1].length;
            const wasChecked = match[2].toLowerCase() === "x";
            const replacement = wasChecked ? "[ ]" : "[x]";

            view.dispatch({
              changes: { from: bracketStart, to: bracketStart + 3, insert: replacement },
            });

            return true;
          },
        },
      },
    ),
    EditorView.baseTheme({
      ".cork-cm-checkbox": {
        cursor: "pointer",
        verticalAlign: "middle",
        marginRight: "4px",
        accentColor: "var(--color-cork-accent)",
      },
    }),
  ];
}
