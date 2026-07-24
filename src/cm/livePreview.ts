/**
 * Live preview — Obsidian-style inline rendering for CodeMirror 6.
 *
 * Lines the caret is on show raw markdown; everywhere else the syntax
 * markers are concealed so the text reads like the preview pane:
 * `#` heading marks, emphasis/strikethrough/inline-code marks, link
 * URLs, wikilink brackets, blockquote `>` chevrons, bullet dashes and
 * horizontal rules.
 *
 * The markdown on disk is never touched — this is decoration-only.
 */

import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { EditorState, Range } from "@codemirror/state";

const TASK_LINE_RE = /^\s*[-*+]\s\[[ xX]\]/;
const WIKILINK_RE = /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-cork-lp-bullet";
    span.textContent = "•";
    return span;
  }
  eq() {
    return true;
  }
}

class HrWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-cork-lp-hr";
    return span;
  }
  eq() {
    return true;
  }
  ignoreEvent() {
    return false;
  }
}

/** True when any selection range touches the lines spanned by [from, to]. */
function selectionOnLines(state: EditorState, from: number, to: number): boolean {
  const start = state.doc.lineAt(from).from;
  const end = state.doc.lineAt(Math.min(to, state.doc.length)).to;
  return state.selection.ranges.some((r) => r.to >= start && r.from <= end);
}

/** Extend a mark's end to swallow one trailing space (e.g. `# `, `> `). */
function withTrailingSpace(state: EditorState, to: number): number {
  return state.doc.sliceString(to, to + 1) === " " ? to + 1 : to;
}

function buildDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const conceals: Range<Decoration>[] = [];
  const marks: Range<Decoration>[] = [];
  const lineDecos: Range<Decoration>[] = [];
  const quoteLines = new Set<number>();
  const codeMark = Decoration.mark({ class: "cm-cork-lp-inline-code" });

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const parent = node.node.parent?.name ?? "";
        switch (node.name) {
          case "HeaderMark": {
            // ATX `#` marks and setext underlines
            if (selectionOnLines(state, node.from, node.to)) return;
            conceals.push(
              Decoration.replace({}).range(node.from, withTrailingSpace(state, node.to)),
            );
            return;
          }
          case "EmphasisMark":
          case "StrikethroughMark": {
            if (selectionOnLines(state, node.from, node.to)) return;
            conceals.push(Decoration.replace({}).range(node.from, node.to));
            return;
          }
          case "InlineCode": {
            marks.push(codeMark.range(node.from, node.to));
            return;
          }
          case "CodeMark": {
            if (parent !== "InlineCode") return;
            if (selectionOnLines(state, node.from, node.to)) return;
            conceals.push(Decoration.replace({}).range(node.from, node.to));
            return;
          }
          case "Link": {
            if (selectionOnLines(state, node.from, node.to)) return;
            // Hide every structural child ([, ], (, url, )) — the visible
            // remainder is the link text, already styled by the highlighter.
            let child = node.node.firstChild;
            while (child) {
              if (child.name === "LinkMark" || child.name === "URL" || child.name === "LinkTitle") {
                conceals.push(Decoration.replace({}).range(child.from, child.to));
              }
              child = child.nextSibling;
            }
            return false;
          }
          case "QuoteMark": {
            const line = state.doc.lineAt(node.from);
            quoteLines.add(line.from);
            if (selectionOnLines(state, node.from, node.to)) return;
            conceals.push(
              Decoration.replace({}).range(node.from, withTrailingSpace(state, node.to)),
            );
            return;
          }
          case "ListMark": {
            if (parent !== "ListItem") return;
            if (selectionOnLines(state, node.from, node.to)) return;
            const line = state.doc.lineAt(node.from);
            const markText = state.doc.sliceString(node.from, node.to);
            if (!/^[-*+]$/.test(markText)) return; // keep ordered-list numbers raw
            if (TASK_LINE_RE.test(line.text)) {
              // Task line — the checkbox widget is the affordance; drop the dash
              conceals.push(
                Decoration.replace({}).range(node.from, withTrailingSpace(state, node.to)),
              );
            } else {
              conceals.push(
                Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to),
              );
            }
            return;
          }
          case "HorizontalRule": {
            if (selectionOnLines(state, node.from, node.to)) return;
            conceals.push(Decoration.replace({ widget: new HrWidget() }).range(node.from, node.to));
            return;
          }
        }
      },
    });

    // Wikilinks are not part of the Lezer tree — conceal via regex
    const text = state.sliceDoc(from, to);
    WIKILINK_RE.lastIndex = 0;
    let match;
    while ((match = WIKILINK_RE.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (selectionOnLines(state, start, end)) continue;
      if (match[2]) {
        // [[target|alias]] → show alias
        conceals.push(Decoration.replace({}).range(start, start + 2 + match[1].length + 1));
        conceals.push(Decoration.replace({}).range(end - 2, end));
      } else {
        // [[target]] → show target
        conceals.push(Decoration.replace({}).range(start, start + 2));
        conceals.push(Decoration.replace({}).range(end - 2, end));
      }
    }
  }

  for (const lineFrom of quoteLines) {
    lineDecos.push(Decoration.line({ class: "cm-cork-lp-quote-line" }).range(lineFrom));
  }

  // Sort, then drop ranges that overlap an already-kept range — overlapping
  // replace decorations are invalid in CM6 (wikilink + tree can both claim
  // the same text in odd nestings).
  conceals.sort((a, b) => a.from - b.from || a.to - b.to);
  const kept: Range<Decoration>[] = [];
  let lastTo = -1;
  for (const range of conceals) {
    if (range.from < lastTo) continue;
    kept.push(range);
    lastTo = Math.max(lastTo, range.to);
  }

  return Decoration.set([...kept, ...marks, ...lineDecos], true);
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const livePreviewTheme = EditorView.baseTheme({
  ".cm-cork-lp-bullet": {
    color: "var(--color-cork-muted)",
    display: "inline-block",
    width: "1ch",
  },
  ".cm-cork-lp-hr": {
    display: "inline-block",
    width: "100%",
    verticalAlign: "middle",
    borderTop: "1px solid var(--color-cork-border)",
  },
  ".cm-cork-lp-inline-code": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--color-cork-panel-2)",
    borderRadius: "4px",
    padding: "1px 4px",
  },
  ".cm-cork-lp-quote-line": {
    borderLeft: "3px solid var(--color-cork-border)",
    paddingLeft: "12px",
    color: "var(--color-cork-muted)",
  },
});

export function livePreviewExtension() {
  return [livePreviewPlugin, livePreviewTheme];
}
