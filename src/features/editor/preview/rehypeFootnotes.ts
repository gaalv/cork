type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

export function rehypeFootnotes() {
  return function transform(tree: HastNode): void {
    visit(tree, normalizeFootnoteNode);
  };
}

function visit(node: HastNode, visitor: (node: HastNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function normalizeFootnoteNode(node: HastNode): void {
  if (node.type !== "element") {
    return;
  }
  node.properties ??= {};
  if (node.tagName === "section" && "dataFootnotes" in node.properties) {
    node.properties.className = ["footnotes"];
  }
  normalizeIdProperty(node.properties, "id");
  normalizeHrefProperty(node.properties);
}

function normalizeIdProperty(properties: Record<string, unknown>, key: string): void {
  const value = properties[key];
  if (typeof value === "string" && value.startsWith("user-content-")) {
    properties[key] = value.slice("user-content-".length);
  }
}

function normalizeHrefProperty(properties: Record<string, unknown>): void {
  const value = properties.href;
  if (typeof value === "string" && value.startsWith("#user-content-")) {
    properties.href = `#${value.slice("#user-content-".length)}`;
  }
}
