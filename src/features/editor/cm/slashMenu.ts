import { autocompletion, CompletionContext } from "@codemirror/autocomplete";

import type { Completion, CompletionResult } from "@codemirror/autocomplete";

const blocks: Completion[] = [
  { label: "/h1", detail: "Heading 1", apply: "# " },
  { label: "/h2", detail: "Heading 2", apply: "## " },
  { label: "/h3", detail: "Heading 3", apply: "### " },
  { label: "/code", detail: "Code block", apply: "```ts\n\n```" },
  { label: "/callout", detail: "Callout", apply: "> [!note]\n> " },
  { label: "/divider", detail: "Divider", apply: "---" },
  { label: "/table", detail: "Table", apply: "| Column | Value |\n| --- | --- |\n|  |  |" },
  { label: "/image", detail: "Image", apply: "![alt](path)" },
  { label: "/math", detail: "Math block", apply: "$$\n\n$$" },
  { label: "/mermaid", detail: "Mermaid", apply: "```mermaid\nflowchart LR\n  A-->B\n```" },
];

export const slashMenu = autocompletion({ override: [slashCompletionSource] });

export function slashCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const prefix = context.state.doc.sliceString(line.from, context.pos);
  if (!/^\/[\w-]*$/.test(prefix)) {
    return null;
  }
  const query = prefix.slice(1).toLowerCase();
  return {
    from: line.from,
    to: context.pos,
    options: blocks.filter((block) => block.label.toLowerCase().includes(query)),
    filter: false,
  };
}
