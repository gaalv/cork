const knownCalloutKinds = new Set(["note", "info", "tip", "warning", "danger", "success", "quote", "abstract", "example"]);

const defaultLabels = new Map([
  ["note", "Note"],
  ["info", "Info"],
  ["tip", "Tip"],
  ["warning", "Warning"],
  ["danger", "Danger"],
  ["success", "Success"],
  ["quote", "Quote"],
  ["abstract", "Abstract"],
  ["example", "Example"],
]);

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, string | string[]>;
  };
};

export function remarkCallouts() {
  return function transform(tree: MdastNode): void {
    visit(tree, transformBlockquote);
  };
}

function calloutHeader(title: string): MdastNode {
  return {
    type: "paragraph",
    data: { hName: "header", hProperties: { className: ["callout-title"] } },
    children: [{ type: "text", value: title }],
  };
}

function visit(node: MdastNode, visitor: (node: MdastNode) => void): void {
  visitor(node);
  for (const child of node.children ?? []) {
    visit(child, visitor);
  }
}

function transformBlockquote(node: MdastNode): void {
  if (node.type !== "blockquote") {
    return;
  }
  const firstChild = node.children?.[0];
  const firstText = firstChild?.children?.[0];
  if (firstChild?.type !== "paragraph" || firstText?.type !== "text" || !firstText.value) {
    return;
  }

  const match = /^\[!(?<kind>[A-Za-z][\w-]*)\]\s*(?<title>[^\r\n]*)/.exec(firstText.value);
  if (!match?.groups?.kind) {
    return;
  }

  const rawKind = match.groups.kind.toLowerCase();
  const kind = knownCalloutKinds.has(rawKind) ? rawKind : "note";
  if (kind !== rawKind && import.meta.env.DEV) {
    console.warn(`Unknown Markdown callout kind: ${rawKind}`);
  }

  node.data = {
    ...node.data,
    hName: "aside",
    hProperties: {
      ...(node.data?.hProperties ?? {}),
      className: ["callout", `callout-${kind}`],
      dataKind: kind,
    },
  };

  const title = match.groups.title.trim() || defaultLabels.get(kind) || "Note";
  const header = calloutHeader(title);
  const remainingText = firstText.value.slice(match[0].length).replace(/^\r?\n/, "");
  if (remainingText.trim().length > 0) {
    firstText.value = remainingText;
    node.children = [header, ...(node.children ?? [])];
  } else {
    firstChild.data = header.data;
    firstChild.children = header.children;
  }
}
