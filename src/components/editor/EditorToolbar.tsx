/**
 * EditorToolbar — floating Markdown formatting toolbar.
 *
 * Provides quick-access buttons for common Markdown syntax so
 * users unfamiliar with Markdown can format text visually.
 */

import {
  TextB,
  TextItalic,
  TextStrikethrough,
  TextHOne,
  TextHTwo,
  TextHThree,
  ListBullets,
  ListNumbers,
  ListChecks,
  Quotes,
  Code,
  CodeBlock,
  Link,
  Image,
  MinusSquare,
} from "@phosphor-icons/react";

import { getEditorView } from "@/cm/viewRef";

type FormatAction = {
  icon: React.ReactNode;
  title: string;
  apply: () => void;
};

function wrapSelection(before: string, after: string) {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const wrapped = `${before}${selected || "text"}${after}`;
  view.dispatch({
    changes: { from, to, insert: wrapped },
    selection: {
      anchor: from + before.length,
      head: from + before.length + (selected || "text").length,
    },
  });
  view.focus();
}

function prefixLine(prefix: string) {
  const view = getEditorView();
  if (!view) return;
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: prefix },
  });
  view.focus();
}

function insertAtCursor(text: string, cursorOffset?: number) {
  const view = getEditorView();
  if (!view) return;
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (cursorOffset ?? text.length) },
  });
  view.focus();
}

const actions: FormatAction[] = [
  { icon: <TextB size={15} />, title: "Bold (⌘B)", apply: () => wrapSelection("**", "**") },
  { icon: <TextItalic size={15} />, title: "Italic (⌘I)", apply: () => wrapSelection("*", "*") },
  {
    icon: <TextStrikethrough size={15} />,
    title: "Strikethrough",
    apply: () => wrapSelection("~~", "~~"),
  },
  { icon: <TextHOne size={15} />, title: "Heading 1", apply: () => prefixLine("# ") },
  { icon: <TextHTwo size={15} />, title: "Heading 2", apply: () => prefixLine("## ") },
  { icon: <TextHThree size={15} />, title: "Heading 3", apply: () => prefixLine("### ") },
  { icon: <ListBullets size={15} />, title: "Bullet list", apply: () => prefixLine("- ") },
  { icon: <ListNumbers size={15} />, title: "Numbered list", apply: () => prefixLine("1. ") },
  { icon: <ListChecks size={15} />, title: "Task list", apply: () => prefixLine("- [ ] ") },
  { icon: <Quotes size={15} />, title: "Blockquote", apply: () => prefixLine("> ") },
  { icon: <Code size={15} />, title: "Inline code", apply: () => wrapSelection("`", "`") },
  {
    icon: <CodeBlock size={15} />,
    title: "Code block",
    apply: () => wrapSelection("```\n", "\n```"),
  },
  {
    icon: <Link size={15} />,
    title: "Link",
    apply: () => insertAtCursor("[text](url)", 1),
  },
  {
    icon: <Image size={15} />,
    title: "Image",
    apply: () => insertAtCursor("![alt](url)", 2),
  },
  {
    icon: <MinusSquare size={15} />,
    title: "Horizontal rule",
    apply: () => insertAtCursor("\n---\n"),
  },
];

// Group actions visually: inline | headings | lists | blocks | insert
const groups = [
  actions.slice(0, 3), // bold, italic, strikethrough
  actions.slice(3, 6), // h1, h2, h3
  actions.slice(6, 9), // bullet, numbered, task
  actions.slice(9, 12), // quote, code, code block
  actions.slice(12), // link, image, hr
];

export function EditorToolbar() {
  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--color-cork-border)] px-4 py-1">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center">
          {gi > 0 && <div className="mx-1.5 h-4 w-px bg-[var(--color-cork-border)]" />}
          {group.map((action, ai) => (
            <button
              key={ai}
              onMouseDown={(e) => {
                e.preventDefault(); // keep editor focus
                action.apply();
              }}
              title={action.title}
              className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
            >
              {action.icon}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
