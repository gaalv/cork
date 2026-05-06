type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
  position?: { start?: { offset?: number } };
  data?: {
    hName?: string;
    hProperties?: Record<string, string | string[]>;
  };
};

type MarkdownFile = { value?: unknown };

export function remarkHighlight() {
  return function transform(tree: MdastNode, file: MarkdownFile): void {
    rewriteChildren(tree, typeof file.value === "string" ? file.value : "");
  };
}

function rewriteChildren(node: MdastNode, source: string): void {
  if (!node.children) {
    return;
  }
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value?.includes("==")) {
      return splitHighlightText(child.value, source, child.position?.start?.offset ?? 0);
    }
    rewriteChildren(child, source);
    return [child];
  });
}

function splitHighlightText(value: string, source: string, sourceOffset: number): MdastNode[] {
  const nodes: MdastNode[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const start = value.indexOf("==", cursor);
    if (start === -1) {
      pushText(nodes, value.slice(cursor));
      break;
    }
    if (value[start - 1] === "\\" || source[sourceOffset + start] === "\\" || source[sourceOffset + start - 1] === "\\") {
      pushText(nodes, value.slice(cursor, value[start - 1] === "\\" ? start - 1 : start));
      pushText(nodes, "==");
      cursor = start + 2;
      continue;
    }
    const end = value.indexOf("==", start + 2);
    if (end === -1) {
      pushText(nodes, value.slice(cursor));
      break;
    }
    const content = value.slice(start + 2, end);
    if (content.length === 0 || content.includes("\n") || /^!?\[/.test(content)) {
      pushText(nodes, value.slice(cursor, end + 2));
      cursor = end + 2;
      continue;
    }
    pushText(nodes, value.slice(cursor, start));
    nodes.push({
      type: "emphasis",
      data: { hName: "mark" },
      children: [{ type: "text", value: content }],
    });
    cursor = end + 2;
  }
  return nodes;
}

function pushText(nodes: MdastNode[], value: string): void {
  if (value.length > 0) {
    nodes.push({ type: "text", value });
  }
}
