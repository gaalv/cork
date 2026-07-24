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
// inline delimiters must not hug whitespace). Multi-line `$$` blocks render in
// the preview pane; the editor styles them via code-fence handling.
const BLOCK_MATH_RE = /\$\$([^\n]+?)\$\$/g;
const INLINE_MATH_RE = /\$([^$\n]+?)\$/g;

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
  constructor(
    private readonly tex: string,
    private readonly display: boolean,
  ) {
    super();
  }
  eq(other: MathWidget) {
    return other.tex === this.tex && other.display === this.display;
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
  const calloutLines = new Map<number, CalloutFamily>();
  const codeLines = new Map<number, boolean>(); // line.from → dimmed fence line
  const tableLines = new Map<number, boolean>(); // line.from → striped row
  const codeRanges: { from: number; to: number }[] = []; // no ==highlight== inside code
  const codeMark = Decoration.mark({ class: "cm-cork-lp-inline-code" });
  const highlightMark = Decoration.mark({ class: "cm-cork-lp-highlight" });

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
              codeLines.set(line.from, isFence && focused);
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

    // Conceal wikilink markers (spans were collected before the tree walk).
    for (const w of wikilinks) {
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
      const start = from + match.index;
      const end = start + match[0].length;
      if (codeRanges.some((r) => start < r.to && end > r.from)) continue;
      if (mathRanges.some((r) => start < r.to && end > r.from)) continue;
      if (!katexMod) loadKatex();
      if (selectionOnLines(state, start, end)) continue;
      conceals.push(Decoration.replace({ widget: new MathWidget(inner, false) }).range(start, end));
    }
  }

  for (const lineFrom of quoteLines) {
    if (calloutLines.has(lineFrom)) continue; // callout styling wins
    lineDecos.push(Decoration.line({ class: "cm-cork-lp-quote-line" }).range(lineFrom));
  }
  for (const [lineFrom, family] of calloutLines) {
    lineDecos.push(
      Decoration.line({
        class: `cm-cork-lp-callout-line cm-cork-lp-callout-${family}`,
      }).range(lineFrom),
    );
  }
  for (const [lineFrom, dimmed] of codeLines) {
    lineDecos.push(
      Decoration.line({
        class: dimmed ? "cm-cork-lp-code-line cm-cork-lp-fence-dim" : "cm-cork-lp-code-line",
      }).range(lineFrom),
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
    private readonly refresh: () => void;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
      // Rebuild once KaTeX finishes loading so raw math swaps to rendered.
      this.refresh = () => view.dispatch({ effects: katexLoadedEffect.of(null) });
      if (!katexMod) katexWaiters.add(this.refresh);
    }
    update(update: ViewUpdate) {
      const katexRefresh = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(katexLoadedEffect)),
      );
      if (update.docChanged || update.viewportChanged || update.selectionSet || katexRefresh) {
        this.decorations = buildDecorations(update.view);
      }
    }
    destroy() {
      katexWaiters.delete(this.refresh);
    }
  },
  { decorations: (v) => v.decorations },
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
    if (tr.docChanged || tr.selection) return buildTableDecorations(tr.state);
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
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
    borderLeft: "3px solid var(--color-cork-border)",
    paddingLeft: "12px",
    color: "var(--color-cork-muted)",
  },
  ".cm-cork-lp-highlight": {
    backgroundColor: "var(--color-cork-accent-soft)",
    borderRadius: "3px",
    padding: "1px 2px",
  },
  ".cm-cork-lp-callout-line": {
    borderLeft: "3px solid var(--color-cork-accent)",
    paddingLeft: "12px",
    backgroundColor: "var(--color-cork-panel-2)",
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
    letterSpacing: "0.02em",
  },
  ".cm-cork-lp-callout-tip .cm-cork-lp-callout-label": {
    color: "var(--color-cork-success)",
  },
  ".cm-cork-lp-callout-warning .cm-cork-lp-callout-label": {
    color: "var(--color-cork-danger)",
  },
  ".cm-cork-lp-code-line": {
    backgroundColor: "var(--color-cork-panel-2)",
  },
  ".cm-cork-lp-fence-dim": {
    opacity: "0.55",
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
  return [tableField, livePreviewPlugin, livePreviewTheme];
}
