type MarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MarkdownNode[];
};

const wikilinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function remarkWikilink() {
  return (tree: MarkdownNode) => {
    transformNode(tree);
  };
}

function transformNode(node: MarkdownNode) {
  if (node.type === "text" && typeof node.value === "string") {
    return splitTextNode(node);
  }
  if (node.children) {
    node.children = node.children.flatMap((child) => transformNode(child));
  }
  return [node];
}

function splitTextNode(node: MarkdownNode): MarkdownNode[] {
  const value = node.value ?? "";
  const result: MarkdownNode[] = [];
  let lastIndex = 0;
  for (const match of value.matchAll(wikilinkPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      result.push({ type: "text", value: value.slice(lastIndex, index) });
    }
    const target = match[1] ?? "";
    const label = match[2] ?? target;
    result.push({
      type: "link",
      url: `/wiki/${encodeURIComponent(target)}`,
      title: null,
      children: [{ type: "text", value: label }],
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < value.length) {
    result.push({ type: "text", value: value.slice(lastIndex) });
  }
  return result.length > 0 ? result : [node];
}
