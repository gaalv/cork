import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";

import { liveModeFacet } from "./liveModeFacet";

import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import type { Range } from "@codemirror/state";

type InlineRule = {
  className: string;
  pattern: RegExp;
  markerLength: (match: RegExpMatchArray) => { left: number; right: number };
};

const RULES: InlineRule[] = [
  { className: "cm-md-bold", pattern: /\*\*(?=\S)([^*\n]+?[^*\s])\*\*/g, markerLength: () => ({ left: 2, right: 2 }) },
  { className: "cm-md-bold", pattern: /__(?=\S)([^_\n]+?[^_\s])__/g, markerLength: () => ({ left: 2, right: 2 }) },
  { className: "cm-md-italic", pattern: /(?<!\*)\*(?!\*)(?=\S)([^*\n]+?[^*\s])\*(?!\*)/g, markerLength: () => ({ left: 1, right: 1 }) },
  { className: "cm-md-italic", pattern: /(?<![_A-Za-z0-9])_(?=\S)([^_\n]+?[^_\s])_(?![_A-Za-z0-9])/g, markerLength: () => ({ left: 1, right: 1 }) },
  { className: "cm-md-strike", pattern: /~~(?=\S)([^~\n]+?[^~\s])~~/g, markerLength: () => ({ left: 2, right: 2 }) },
  { className: "cm-md-code", pattern: /`([^`\n]+)`/g, markerLength: () => ({ left: 1, right: 1 }) },
];

const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;

class HiddenWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "none";
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

const HIDDEN = new HiddenWidget();

export const liveMarkdownDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = build(view);
    }

    update(update: ViewUpdate) {
      const modeChanged =
        update.startState.facet(liveModeFacet) !== update.state.facet(liveModeFacet);
      if (update.docChanged || update.selectionSet || update.viewportChanged || modeChanged) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function build(view: EditorView): DecorationSet {
  const mode = view.state.facet(liveModeFacet);
  if (mode === "source") {
    return Decoration.none;
  }

  const cursor = view.state.selection.main.head;
  const ranges: Range<Decoration>[] = [];
  const fenceLines = collectFenceLines(view);

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (!fenceLines.has(line.number)) {
        decorateInlineRanges(line.from, line.text, cursor, ranges);
        decorateLinks(line.from, line.text, cursor, ranges);
      }
      pos = line.to + 1;
      if (pos > view.state.doc.length) break;
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);
  return Decoration.set(ranges, true);
}

function decorateInlineRanges(
  lineStart: number,
  text: string,
  cursor: number,
  out: Range<Decoration>[],
): void {
  const claimed: Array<{ from: number; to: number }> = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(text)) !== null) {
      const matchStart = lineStart + (match.index ?? 0);
      const matchEnd = matchStart + match[0].length;
      if (claimed.some((c) => overlap(c, { from: matchStart, to: matchEnd }))) {
        continue;
      }
      const { left, right } = rule.markerLength(match);
      const innerFrom = matchStart + left;
      const innerTo = matchEnd - right;
      out.push(Decoration.mark({ class: rule.className }).range(innerFrom, innerTo));
      const caretInside = cursor >= matchStart && cursor <= matchEnd;
      if (!caretInside) {
        out.push(Decoration.replace({ widget: HIDDEN }).range(matchStart, innerFrom));
        out.push(Decoration.replace({ widget: HIDDEN }).range(innerTo, matchEnd));
      }
      claimed.push({ from: matchStart, to: matchEnd });
    }
  }
}

function decorateLinks(
  lineStart: number,
  text: string,
  cursor: number,
  out: Range<Decoration>[],
): void {
  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_PATTERN.exec(text)) !== null) {
    const matchStart = lineStart + (match.index ?? 0);
    const labelStart = matchStart + 1;
    const labelEnd = labelStart + (match[1]?.length ?? 0);
    const matchEnd = matchStart + match[0].length;
    const url = match[2] ?? "";
    out.push(
      Decoration.mark({
        class: "cm-md-link",
        attributes: { "data-md-href": url },
      }).range(labelStart, labelEnd),
    );
    const caretInside = cursor >= matchStart && cursor <= matchEnd;
    if (!caretInside) {
      out.push(Decoration.replace({ widget: HIDDEN }).range(matchStart, labelStart));
      out.push(Decoration.replace({ widget: HIDDEN }).range(labelEnd, matchEnd));
    }
  }
}

function collectFenceLines(view: EditorView): Set<number> {
  const fenceLines = new Set<number>();
  const doc = view.state.doc;
  let inside = false;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (/^\s*```/.test(line.text)) {
      fenceLines.add(line.number);
      inside = !inside;
      continue;
    }
    if (inside) {
      fenceLines.add(line.number);
    }
  }
  return fenceLines;
}

function overlap(a: { from: number; to: number }, b: { from: number; to: number }): boolean {
  return a.from < b.to && b.from < a.to;
}
