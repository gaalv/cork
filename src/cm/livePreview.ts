/**
 * Live preview — Obsidian-style inline rendering for CodeMirror 6.
 *
 * Lines the caret is on show raw markdown; everywhere else the syntax
 * markers are concealed so the text reads like the preview pane:
 * `#` heading marks, emphasis/strikethrough/inline-code marks, link
 * URLs, wikilink brackets, blockquote `>` chevrons, bullet dashes and
 * horizontal rules.
 *
 * F44 extends this with block-level polish: `==highlight==` conceal +
 * background mark, callout styling for `> [!type]` blockquotes, fenced
 * code block line backgrounds with dimmed fence lines, and mono +
 * striped pipe-table lines.
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
import { StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";

const TASK_LINE_RE = /^\s*[-*+]\s\[[ xX]\]/;
const WIKILINK_RE = /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;
const HIGHLIGHT_RE = /==([^=\n]+?)==/g;
const CALLOUT_RE = /^(?:>\s*)+\[!([A-Za-z][\w-]*)\]/;
const FENCE_LINE_RE = /^\s*(?:`{3,}|~{3,})/;
// Single-line display math `$$…$$` and inline math `$…$` (remark-math parity:
// inline delimiters must not hug whitespace). Multi-line `$$` blocks are block
// decorations, so they live in `blockMathField` further down.
const BLOCK_MATH_RE = /\$\$([^\n]+?)\$\$/g;
const INLINE_MATH_RE = /\$([^$\n]+?)\$/g;
// A `$` glued to a word/digit is currency, not a delimiter — `R$50`, `$5-$10`.
const MATH_BOUNDARY_RE = /[\p{L}\p{N}]/u;
// `$1,200$` is money that happened to be bracketed; real math has a symbol.
const CURRENCY_LIKE_RE = /^[\d.,\s]*$/;
// Opening/closing fences of a multi-line `$$` block.
const BLOCK_MATH_OPEN_RE = /^\s*\$\$\s*$/;
const BLOCK_MATH_CLOSE_RE = /\$\$\s*$/;

// KaTeX is ~280 kB — lazy-load it so it stays out of the main editor chunk
// (shares the chunk the preview pipeline already creates). Until it resolves,
// math shows raw; on load, mounted editors rebuild their decorations.
type KatexModule = { renderToString: (tex: string, opts?: unknown) => string };
let katexMod: KatexModule | null = null;
let katexLoading = false;
const katexWaiters = new Set<() => void>();

/** Refresh signal dispatched to a view once KaTeX has loaded. */
const katexLoadedEffect = StateEffect.define<null>();

function loadKatex(): void {
  if (katexMod || katexLoading) return;
  katexLoading = true;
  void import("katex").then((m) => {
    katexMod = m.default as unknown as KatexModule;
    katexLoading = false;
    for (const cb of katexWaiters) cb();
    katexWaiters.clear();
  });
}

type CalloutFamily = "note" | "tip" | "warning";

/** How a line inside a fenced code block should be painted. */
type CodeLineKind = "body" | "top" | "bottom" | "fence-open";

/** Where a line sits inside its block — drives the padding and rounded caps. */
type BlockPos = "top" | "bottom" | "both" | "body";

/** Cap classes for a line, so a block gets padding around all of its content. */
function capClasses(pos: BlockPos | undefined): string {
  if (pos === "both") return " cm-cork-lp-block-top cm-cork-lp-block-bottom";
  if (pos === "top") return " cm-cork-lp-block-top";
  if (pos === "bottom") return " cm-cork-lp-block-bottom";
  return "";
}

/** Lezer heading node → level, used for the block spacing above headings. */
const HEADING_NODES = new Map<string, number>([
  ["ATXHeading1", 1],
  ["ATXHeading2", 2],
  ["ATXHeading3", 3],
  ["ATXHeading4", 4],
  ["ATXHeading5", 5],
  ["ATXHeading6", 6],
  ["SetextHeading1", 1],
  ["SetextHeading2", 2],
]);

/** Map callout types onto the three visual families (unknown → note). */
const CALLOUT_FAMILIES: Record<string, CalloutFamily> = {
  tip: "tip",
  hint: "tip",
  success: "tip",
  check: "tip",
  done: "tip",
  warning: "warning",
  caution: "warning",
  danger: "warning",
  error: "warning",
  bug: "warning",
  attention: "warning",
  failure: "warning",
};

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

class CalloutLabelWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-cork-lp-callout-label";
    span.textContent = this.label.toUpperCase();
    return span;
  }
  eq(other: CalloutLabelWidget) {
    return other.label === this.label;
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

/** Renders `$…$` / `$$…$$` via KaTeX once it has lazy-loaded. */
class MathWidget extends WidgetType {
  /**
   * Whether KaTeX was available when this widget was built. It has to take
   * part in `eq`: without it the post-load rebuild produced widgets that
   * compared equal to the raw-text ones already on screen, so CodeMirror
   * reused the old DOM and the formula never actually rendered.
   */
  private readonly rendered = katexMod !== null;

  constructor(
    private readonly tex: string,
    private readonly display: boolean,
  ) {
    super();
  }
  eq(other: MathWidget) {
    return (
      other.tex === this.tex && other.display === this.display && other.rendered === this.rendered
    );
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = this.display ? "cm-cork-lp-math cm-cork-lp-math-display" : "cm-cork-lp-math";
    if (katexMod) {
      try {
        span.innerHTML = katexMod.renderToString(this.tex, {
          throwOnError: false,
          displayMode: this.display,
        });
      } catch {
        span.textContent = this.display ? `$$${this.tex}$$` : `$${this.tex}$`;
      }
    } else {
      // KaTeX still loading — show raw until the refresh rebuild lands.
      span.textContent = this.display ? `$$${this.tex}$$` : `$${this.tex}$`;
    }
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

/** Renders a multi-line `$$ … $$` block as centred display math. */
class BlockMathWidget extends WidgetType {
  /** See MathWidget.rendered — same lazy-load equality trap. */
  private readonly rendered = katexMod !== null;

  constructor(private readonly tex: string) {
    super();
  }
  eq(other: BlockMathWidget) {
    return other.tex === this.tex && other.rendered === this.rendered;
  }
  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-cork-lp-math-block";
    if (katexMod) {
      try {
        div.innerHTML = katexMod.renderToString(this.tex, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        div.textContent = this.tex;
      }
    } else {
      div.textContent = this.tex;
    }
    return div;
  }
  ignoreEvent() {
    return false;
  }
}

/**
 * Locate multi-line `$$ … $$` blocks. Only the single-line form was ever
 * matched, so the conventional
 *
 *     $$
 *     E = mc^2
 *     $$
 *
 * never rendered in the editor.
 */
function findBlockMath(state: EditorState): { from: number; to: number; tex: string }[] {
  const blocks: { from: number; to: number; tex: string }[] = [];
  for (let i = 1; i <= state.doc.lines; i += 1) {
    const line = state.doc.line(i);
    if (!BLOCK_MATH_OPEN_RE.test(line.text)) continue;
    for (let j = i + 1; j <= state.doc.lines; j += 1) {
      const close = state.doc.line(j);
      if (!BLOCK_MATH_CLOSE_RE.test(close.text)) continue;
      const tex = state.doc.sliceString(line.to + 1, close.from + close.text.lastIndexOf("$$"));
      blocks.push({ from: line.from, to: close.to, tex: tex.trim() });
      i = j;
      break;
    }
  }
  return blocks;
}

type TableAlign = "left" | "center" | "right" | null;

/** Parse a GFM markdown table block into headers/alignment/rows, or null. */
function parseMarkdownTable(
  md: string,
): { headers: string[]; aligns: TableAlign[]; rows: string[][] } | null {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const splitRow = (line: string): string[] => {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((c) => c.trim());
  };
  const delim = splitRow(lines[1]);
  if (delim.length === 0 || !delim.every((c) => /^:?-+:?$/.test(c))) return null;
  const aligns: TableAlign[] = delim.map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
  const headers = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);
  return { headers, aligns, rows };
}

/** Renders a GFM table block as a real `<table>` while the caret is elsewhere. */
class TableWidget extends WidgetType {
  constructor(private readonly md: string) {
    super();
  }
  eq(other: TableWidget) {
    return other.md === this.md;
  }
  toDOM() {
    const table = document.createElement("table");
    table.className = "cm-cork-lp-table";
    const parsed = parseMarkdownTable(this.md);
    if (!parsed) {
      table.textContent = this.md;
      return table;
    }
    const applyAlign = (cell: HTMLTableCellElement, align: TableAlign) => {
      if (align) cell.style.textAlign = align;
    };
    const thead = table.createTHead();
    const headRow = thead.insertRow();
    parsed.headers.forEach((h, i) => {
      const th = document.createElement("th");
      th.textContent = h;
      applyAlign(th, parsed.aligns[i] ?? null);
      headRow.appendChild(th);
    });
    const tbody = table.createTBody();
    for (const row of parsed.rows) {
      const tr = tbody.insertRow();
      for (let i = 0; i < parsed.headers.length; i += 1) {
        const td = tr.insertCell();
        td.textContent = row[i] ?? "";
        applyAlign(td, parsed.aligns[i] ?? null);
      }
    }
    return table;
  }
  ignoreEvent() {
    return false;
  }
}

/** Editor focus, mirrored into state so StateFields can read it too. */
const focusEffect = StateEffect.define<boolean>();

const focusField = StateField.define<boolean>({
  create() {
    return false;
  },
  update(value, tr) {
    for (const e of tr.effects) if (e.is(focusEffect)) return e.value;
    return value;
  },
});

const focusTracker = EditorView.focusChangeEffect.of((_state, focusing) =>
  focusEffect.of(focusing),
);

/**
 * True when the caret sits on the lines spanned by [from, to] *and* the editor
 * has focus — so markers stay concealed once you click away, instead of
 * leaving one line of raw markdown behind.
 */
function selectionOnLines(state: EditorState, from: number, to: number): boolean {
  if (!state.field(focusField, false)) return false;
  const start = state.doc.lineAt(from).from;
  const end = state.doc.lineAt(Math.min(to, state.doc.length)).to;
  return state.selection.ranges.some((r) => r.to >= start && r.from <= end);
}

/** Extend a mark's end to swallow one trailing space (e.g. `# `, `> `). */
function withTrailingSpace(state: EditorState, to: number): number {
  return state.doc.sliceString(to, to + 1) === " " ? to + 1 : to;
}

/**
 * Conceals double as atomic ranges: without that, the caret steps through a
 * hidden `- ` or checkbox one invisible character at a time and looks stuck.
 * Only the replacements are atomic — marks stay editable.
 */
type LivePreviewSets = { decorations: DecorationSet; atomic: DecorationSet };

function buildDecorations(view: EditorView): LivePreviewSets {
  const { state } = view;
  const conceals: Range<Decoration>[] = [];
  const marks: Range<Decoration>[] = [];
  const lineDecos: Range<Decoration>[] = [];
  const quoteLines = new Set<number>();
  const blockBounds = new Map<number, BlockPos>(); // line.from → position in block
  const calloutLines = new Map<number, CalloutFamily>();
  const headingLines = new Map<number, number>(); // line.from → heading level
  const codeLines = new Map<number, CodeLineKind>(); // line.from → how to paint it
  const tableLines = new Map<number, boolean>(); // line.from → striped row
  const codeRanges: { from: number; to: number }[] = []; // no ==highlight== inside code
  const codeMark = Decoration.mark({ class: "cm-cork-lp-inline-code" });
  const highlightMark = Decoration.mark({ class: "cm-cork-lp-highlight" });

  // Multi-line `$$` blocks are rendered by `blockMathField`; nothing here may
  // decorate inside them or the two replace decorations would collide.
  const blockMath = findBlockMath(state);
  // Containment, not overlap: the root Document node spans the whole doc, so an
  // overlap test against it is always true and aborts the entire tree walk.
  const insideBlockMath = (a: number, b: number) => blockMath.some((m) => a >= m.from && b <= m.to);
  // Regex spans are short and never straddle a fence, so overlap is right here.
  const touchesBlockMath = (a: number, b: number) => blockMath.some((m) => a < m.to && b > m.from);

  for (const { from, to } of view.visibleRanges) {
    const text = state.sliceDoc(from, to);

    // Wikilinks aren't in the Lezer tree — collect their spans up front so the
    // Link handler can skip the `[target]` the markdown parser sees nested
    // inside `[[target]]` (otherwise its `]` conceal wins the overlap dedup and
    // leaves a stray trailing `]`).
    const wikilinks: { from: number; to: number; targetLen: number; hasAlias: boolean }[] = [];
    WIKILINK_RE.lastIndex = 0;
    for (let m = WIKILINK_RE.exec(text); m !== null; m = WIKILINK_RE.exec(text)) {
      wikilinks.push({
        from: from + m.index,
        to: from + m.index + m[0].length,
        targetLen: m[1].length,
        hasAlias: Boolean(m[2]),
      });
    }

    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (insideBlockMath(node.from, node.to)) return false;
        const parent = node.node.parent?.name ?? "";
        if (HEADING_NODES.has(node.name)) {
          headingLines.set(state.doc.lineAt(node.from).from, HEADING_NODES.get(node.name) ?? 3);
        }
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
            codeRanges.push({ from: node.from, to: node.to });
            return;
          }
          case "FencedCode": {
            codeRanges.push({ from: node.from, to: node.to });
            const firstFrom = state.doc.lineAt(node.from).from;
            const lastFrom = state.doc.lineAt(node.to).from;
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              const isFence =
                (line.from === firstFrom || line.from === lastFrom) &&
                FENCE_LINE_RE.test(line.text);
              const focused = selectionOnLines(state, line.from, line.to);
              if (isFence && !focused && line.to > line.from) {
                // Conceal the ``` marker line; the code-block background becomes
                // the block's top/bottom padding.
                conceals.push(Decoration.replace({}).range(line.from, line.to));
              }
              let kind: CodeLineKind = "body";
              if (isFence && focused) kind = "fence-open";
              else if (line.from === firstFrom) kind = "top";
              else if (line.from === lastFrom) kind = "bottom";
              codeLines.set(line.from, kind);
              pos = line.to + 1;
            }
            return;
          }
          case "Table": {
            const start = state.doc.lineAt(node.from).from;
            const end = state.doc.lineAt(Math.min(node.to, state.doc.length)).to;
            // Block-level replace decorations (the rendered table) are illegal
            // from a view plugin — they live in `tableField`. Here we only cover
            // the two other states: when the rendered table will show, skip the
            // interior entirely (no inline decos to overlap the block widget);
            // otherwise fall back to raw markdown with striped rows.
            if (
              !selectionOnLines(state, start, end) &&
              parseMarkdownTable(state.sliceDoc(start, end))
            ) {
              codeRanges.push({ from: start, to: end });
              return false;
            }
            let row = 0;
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              tableLines.set(line.from, row % 2 === 1);
              row += 1;
              pos = line.to + 1;
            }
            return;
          }
          case "Blockquote": {
            const firstLine = state.doc.lineAt(node.from);
            const lastLine = state.doc.lineAt(Math.min(node.to, state.doc.length));
            // Record the block extents. `enter` reaches the outermost quote
            // first, so a nested one finds its lines already claimed and the
            // padding stays on the outer block's real edges.
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              if (!blockBounds.has(line.from)) {
                const isFirst = line.from === firstLine.from;
                const isLast = line.from === lastLine.from;
                blockBounds.set(
                  line.from,
                  isFirst && isLast ? "both" : isFirst ? "top" : isLast ? "bottom" : "body",
                );
              }
              pos = line.to + 1;
            }
            if (calloutLines.has(firstLine.from)) return; // nested in a callout
            const callout = CALLOUT_RE.exec(firstLine.text);
            if (!callout) return;
            const family = CALLOUT_FAMILIES[callout[1].toLowerCase()] ?? "note";
            for (let pos = node.from; pos <= node.to; ) {
              const line = state.doc.lineAt(pos);
              calloutLines.set(line.from, family);
              pos = line.to + 1;
            }
            // `[!type]` marker → styled label when the line is inactive
            const markerTo = firstLine.from + callout[0].length;
            const markerFrom = markerTo - callout[1].length - 3;
            if (!selectionOnLines(state, markerFrom, markerTo)) {
              conceals.push(
                Decoration.replace({ widget: new CalloutLabelWidget(callout[1]) }).range(
                  markerFrom,
                  withTrailingSpace(state, markerTo),
                ),
              );
            }
            return;
          }
          case "CodeMark": {
            if (parent !== "InlineCode") return;
            if (selectionOnLines(state, node.from, node.to)) return;
            conceals.push(Decoration.replace({}).range(node.from, node.to));
            return;
          }
          case "Link": {
            // A `[target]` nested inside a wikilink is owned by the wikilink
            // conceal pass — leave it alone.
            if (wikilinks.some((w) => node.from >= w.from && node.to <= w.to)) return false;
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
            const line = state.doc.lineAt(node.from);
            const markText = state.doc.sliceString(node.from, node.to);
            if (!/^[-*+]$/.test(markText)) return; // keep ordered-list numbers raw
            if (TASK_LINE_RE.test(line.text)) {
              // Task line — the checkbox widget is the affordance; drop the
              // dash unconditionally. `[ ]` is already a widget regardless of
              // focus, so un-concealing only the dash made the whole line jump
              // two characters sideways every time the caret entered it.
              conceals.push(
                Decoration.replace({}).range(node.from, withTrailingSpace(state, node.to)),
              );
            } else if (!selectionOnLines(state, node.from, node.to)) {
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

    // Conceal wikilink markers (spans were collected before the tree walk).
    for (const w of wikilinks) {
      if (touchesBlockMath(w.from, w.to)) continue;
      if (selectionOnLines(state, w.from, w.to)) continue;
      if (w.hasAlias) {
        // [[target|alias]] → show alias
        conceals.push(Decoration.replace({}).range(w.from, w.from + 2 + w.targetLen + 1));
      } else {
        // [[target]] → show target
        conceals.push(Decoration.replace({}).range(w.from, w.from + 2));
      }
      conceals.push(Decoration.replace({}).range(w.to - 2, w.to));
    }

    // ==highlight== is not part of the Lezer tree either — regex, skipping code
    let match;
    HIGHLIGHT_RE.lastIndex = 0;
    while ((match = HIGHLIGHT_RE.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (codeRanges.some((r) => start < r.to && end > r.from)) continue;
      if (touchesBlockMath(start, end)) continue;
      marks.push(highlightMark.range(start + 2, end - 2));
      if (selectionOnLines(state, start, end)) continue;
      conceals.push(Decoration.replace({}).range(start, start + 2));
      conceals.push(Decoration.replace({}).range(end - 2, end));
    }

    // Math ($$…$$ single-line first, then $…$) — regex, KaTeX widgets.
    const mathRanges: { from: number; to: number }[] = [];
    BLOCK_MATH_RE.lastIndex = 0;
    while ((match = BLOCK_MATH_RE.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      if (codeRanges.some((r) => start < r.to && end > r.from)) continue;
      if (touchesBlockMath(start, end)) continue;
      mathRanges.push({ from: start, to: end });
      if (!katexMod) loadKatex();
      if (selectionOnLines(state, start, end)) continue;
      conceals.push(
        Decoration.replace({ widget: new MathWidget(match[1].trim(), true) }).range(start, end),
      );
    }
    INLINE_MATH_RE.lastIndex = 0;
    while ((match = INLINE_MATH_RE.exec(text)) !== null) {
      const inner = match[1];
      // remark-math parity: inline delimiters must not hug whitespace.
      if (/^\s|\s$/.test(inner)) continue;
      // …and neither delimiter may be glued to a word or digit, otherwise
      // prose like "custa $5-$10" gets swallowed as a formula.
      const start = from + match.index;
      const end = start + match[0].length;
      const before = start > 0 ? state.doc.sliceString(start - 1, start) : "";
      const after = end < state.doc.length ? state.doc.sliceString(end, end + 1) : "";
      if (MATH_BOUNDARY_RE.test(before) || MATH_BOUNDARY_RE.test(after)) continue;
      // Digits-only content is money, not maths.
      if (CURRENCY_LIKE_RE.test(inner)) continue;
      if (codeRanges.some((r) => start < r.to && end > r.from)) continue;
      if (mathRanges.some((r) => start < r.to && end > r.from)) continue;
      if (touchesBlockMath(start, end)) continue;
      if (!katexMod) loadKatex();
      if (selectionOnLines(state, start, end)) continue;
      conceals.push(Decoration.replace({ widget: new MathWidget(inner, false) }).range(start, end));
    }
  }

  for (const lineFrom of quoteLines) {
    if (calloutLines.has(lineFrom)) continue; // callout styling wins
    lineDecos.push(
      Decoration.line({
        class: `cm-cork-lp-quote-line${capClasses(blockBounds.get(lineFrom))}`,
      }).range(lineFrom),
    );
  }
  for (const [lineFrom, family] of calloutLines) {
    lineDecos.push(
      Decoration.line({
        class: `cm-cork-lp-callout-line cm-cork-lp-callout-${family}${capClasses(
          blockBounds.get(lineFrom),
        )}`,
      }).range(lineFrom),
    );
  }
  const CODE_LINE_CLASS: Record<CodeLineKind, string> = {
    body: "cm-cork-lp-code-line",
    top: "cm-cork-lp-code-line cm-cork-lp-code-top",
    bottom: "cm-cork-lp-code-line cm-cork-lp-code-bottom",
    "fence-open": "cm-cork-lp-code-line cm-cork-lp-fence-dim",
  };
  for (const [lineFrom, kind] of codeLines) {
    lineDecos.push(Decoration.line({ class: CODE_LINE_CLASS[kind] }).range(lineFrom));
  }
  // Block spacing above headings — the flat wall of lines was the main reason
  // the writing surface read as a text dump rather than a document.
  for (const [lineFrom, level] of headingLines) {
    if (lineFrom === 0) continue; // no gap above the very first line
    lineDecos.push(
      Decoration.line({ class: `cm-cork-lp-heading cm-cork-lp-h${Math.min(level, 3)}` }).range(
        lineFrom,
      ),
    );
  }
  for (const [lineFrom, striped] of tableLines) {
    lineDecos.push(
      Decoration.line({
        class: striped ? "cm-cork-lp-table-line cm-cork-lp-table-stripe" : "cm-cork-lp-table-line",
      }).range(lineFrom),
    );
  }

  // Sort, then drop ranges that overlap an already-kept range — overlapping
  // replace decorations are invalid in CM6 (wikilink + tree can both claim
  // the same text in odd nestings).
  // Longest range wins at a given start: the outer construct owns the region.
  // Sorting shortest-first let the `[` of a `[!warning]` callout — which the
  // markdown parser also sees as a Link — beat the callout's own label conceal,
  // so the marker rendered as raw "!warning" instead of a WARNING label.
  conceals.sort((a, b) => a.from - b.from || b.to - a.to);
  const kept: Range<Decoration>[] = [];
  let lastTo = -1;
  for (const range of conceals) {
    if (range.from < lastTo) continue;
    kept.push(range);
    lastTo = Math.max(lastTo, range.to);
  }

  return {
    decorations: Decoration.set([...kept, ...marks, ...lineDecos], true),
    atomic: Decoration.set(kept, true),
  };
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomic: DecorationSet;
    private readonly refresh: () => void;
    constructor(view: EditorView) {
      ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(view));
      // Rebuild once KaTeX finishes loading so raw math swaps to rendered.
      this.refresh = () => view.dispatch({ effects: katexLoadedEffect.of(null) });
      if (!katexMod) katexWaiters.add(this.refresh);
    }
    update(update: ViewUpdate) {
      const katexRefresh = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(katexLoadedEffect)),
      );
      // The markdown parser works incrementally and reports progress through
      // ordinary transactions. Without this check the first paint of a note was
      // built against a partial tree and never refreshed.
      const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        treeChanged ||
        katexRefresh
      ) {
        ({ decorations: this.decorations, atomic: this.atomic } = buildDecorations(update.view));
      }
    }
    destroy() {
      katexWaiters.delete(this.refresh);
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomic ?? Decoration.none),
  },
);

/**
 * Rendered tables live in a state field, not the view plugin: CM6 forbids
 * block / line-break-spanning replace decorations from plugins (it throws
 * "Block decorations may not be specified via plugins" and disables the
 * plugin). A table under the caret is left raw so it stays editable.
 */
// Only descend through block containers when hunting for tables — never into
// inline nodes — so a keystroke doesn't walk the whole tree of a large note.
const TABLE_CONTAINERS = new Set([
  "Document",
  "Blockquote",
  "ListItem",
  "BulletList",
  "OrderedList",
]);

function buildTableDecorations(state: EditorState): DecorationSet {
  const deco: Range<Decoration>[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === "Table") {
        const start = state.doc.lineAt(node.from).from;
        const end = state.doc.lineAt(Math.min(node.to, state.doc.length)).to;
        if (selectionOnLines(state, start, end)) return false;
        const md = state.sliceDoc(start, end);
        if (!parseMarkdownTable(md)) return false;
        deco.push(
          Decoration.replace({ widget: new TableWidget(md), block: true }).range(start, end),
        );
        return false;
      }
      return TABLE_CONTAINERS.has(node.name);
    },
  });
  return Decoration.set(deco, true);
}

const tableField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(value, tr) {
    const focusChanged = tr.effects.some((e) => e.is(focusEffect));
    const treeChanged = syntaxTree(tr.startState) !== syntaxTree(tr.state);
    if (tr.docChanged || tr.selection || focusChanged || treeChanged) {
      return buildTableDecorations(tr.state);
    }
    return value;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

/**
 * Multi-line `$$ … $$` blocks, as block replace decorations — which, like the
 * table widget, may only come from a StateField, never a ViewPlugin.
 */
function buildBlockMathDecorations(state: EditorState): DecorationSet {
  const blocks = findBlockMath(state);
  if (blocks.length === 0) return Decoration.none;
  if (!katexMod) loadKatex();

  const deco: Range<Decoration>[] = [];
  for (const block of blocks) {
    if (selectionOnLines(state, block.from, block.to)) continue;
    deco.push(
      Decoration.replace({ widget: new BlockMathWidget(block.tex), block: true }).range(
        block.from,
        block.to,
      ),
    );
  }
  return Decoration.set(deco, true);
}

const blockMathField = StateField.define<DecorationSet>({
  create(state) {
    return buildBlockMathDecorations(state);
  },
  update(value, tr) {
    const katexRefresh = tr.effects.some((e) => e.is(katexLoadedEffect));
    const focusChanged = tr.effects.some((e) => e.is(focusEffect));
    if (tr.docChanged || tr.selection || katexRefresh || focusChanged) {
      return buildBlockMathDecorations(tr.state);
    }
    return value;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

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
  ".cm-cork-lp-math": {
    cursor: "text",
  },
  ".cm-cork-lp-math-display": {
    display: "inline-block",
    width: "100%",
    textAlign: "center",
    padding: "0.3em 0",
  },
  ".cm-cork-lp-inline-code": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    backgroundColor: "var(--color-cork-panel-2)",
    borderRadius: "4px",
    padding: "1px 4px",
  },
  ".cm-cork-lp-quote-line": {
    borderLeft: "3px solid var(--color-cork-border-strong)",
    paddingLeft: "16px",
    paddingRight: "16px",
    color: "var(--color-cork-muted)",
  },
  // Vertical padding on the first/last line of a block, so the content is
  // inset on all four sides instead of butting against the block's edges.
  ".cm-cork-lp-block-top": {
    paddingTop: "0.5em",
  },
  ".cm-cork-lp-block-bottom": {
    paddingBottom: "0.5em",
  },
  ".cm-cork-lp-highlight": {
    backgroundColor: "var(--color-cork-accent-soft)",
    borderRadius: "3px",
    padding: "1px 2px",
  },
  ".cm-cork-lp-callout-line": {
    borderLeft: "3px solid var(--color-cork-accent)",
    paddingLeft: "16px",
    paddingRight: "16px",
    backgroundColor: "var(--color-cork-panel-2)",
  },
  ".cm-cork-lp-callout-line.cm-cork-lp-block-top": {
    borderTopRightRadius: "8px",
  },
  ".cm-cork-lp-callout-line.cm-cork-lp-block-bottom": {
    borderBottomRightRadius: "8px",
  },
  ".cm-cork-lp-callout-tip": {
    borderLeftColor: "var(--color-cork-success)",
    backgroundColor: "var(--color-cork-success-tint)",
  },
  ".cm-cork-lp-callout-warning": {
    borderLeftColor: "var(--color-cork-danger)",
    backgroundColor: "var(--color-cork-danger-tint)",
  },
  ".cm-cork-lp-callout-label": {
    fontWeight: "600",
    fontSize: "0.85em",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    // The conceal eats the space after `[!type]`, so put it back visually.
    marginRight: "0.5em",
  },
  ".cm-cork-lp-callout-tip .cm-cork-lp-callout-label": {
    color: "var(--color-cork-success)",
  },
  ".cm-cork-lp-callout-warning .cm-cork-lp-callout-label": {
    color: "var(--color-cork-danger)",
  },
  ".cm-cork-lp-code-line": {
    backgroundColor: "var(--color-cork-panel-2)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    paddingLeft: "16px",
    paddingRight: "16px",
  },
  // The ``` fence lines are concealed but still occupy a full line box, which
  // read as a big empty gap inside the block. Collapse them to nothing and let
  // real padding provide the top/bottom inset instead. (A focused fence line
  // gets `fence-open` instead of these, so it stays visible while editing.)
  ".cm-cork-lp-code-top": {
    borderTopLeftRadius: "8px",
    borderTopRightRadius: "8px",
    fontSize: "0",
    paddingTop: "12px",
  },
  ".cm-cork-lp-code-bottom": {
    borderBottomLeftRadius: "8px",
    borderBottomRightRadius: "8px",
    fontSize: "0",
    paddingBottom: "12px",
  },

  ".cm-cork-lp-fence-dim": {
    color: "var(--color-cork-subtle)",
  },
  ".cm-cork-lp-math-block": {
    padding: "0.6em 0",
    textAlign: "center",
    cursor: "text",
  },
  // Block spacing above headings — padding, not margin, so CodeMirror's line
  // height measurement stays accurate (margins collapse, padding doesn't).
  ".cm-cork-lp-heading": {
    paddingBottom: "var(--editor-para-gap)",
  },
  ".cm-cork-lp-h1": {
    paddingTop: "var(--editor-h1-gap)",
  },
  ".cm-cork-lp-h2": {
    paddingTop: "var(--editor-h2-gap)",
  },
  ".cm-cork-lp-h3": {
    paddingTop: "var(--editor-h3-gap)",
  },
  ".cm-cork-lp-table-line": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
  },
  ".cm-cork-lp-table-stripe": {
    backgroundColor: "var(--color-cork-panel-2)",
  },
  ".cm-cork-lp-table": {
    borderCollapse: "collapse",
    margin: "0.3em 0",
    fontSize: "0.95em",
    lineHeight: "1.4",
  },
  ".cm-cork-lp-table th, .cm-cork-lp-table td": {
    border: "1px solid var(--color-cork-border)",
    padding: "4px 10px",
    textAlign: "left",
  },
  ".cm-cork-lp-table th": {
    backgroundColor: "var(--color-cork-panel-2)",
    fontWeight: "600",
  },
});

export function livePreviewExtension() {
  return [
    focusField,
    focusTracker,
    blockMathField,
    tableField,
    livePreviewPlugin,
    livePreviewTheme,
  ];
}
