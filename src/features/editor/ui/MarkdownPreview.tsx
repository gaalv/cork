/**
 * MarkdownPreview — renders the note body as styled HTML.
 *
 * Uses unified/remark/rehype pipeline with GFM, math (KaTeX),
 * callouts, footnotes, and Mermaid diagram support.
 * Wikilinks render as styled bold text (navigable in editor mode).
 */

import { useEffect, useMemo, useRef, useState, Fragment, type ComponentPropsWithoutRef } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import rehypeReact from "rehype-react";
import mermaid from "mermaid";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { resolveAssetSrc } from "@/features/assets/services/assetResolver";

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  fontFamily: "var(--font-sans)",
  securityLevel: "strict",
});

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "style"],
    span: [
      ...(defaultSchema.attributes?.["span"] ?? []),
      "className",
      "style",
    ],
    div: [
      ...(defaultSchema.attributes?.["div"] ?? []),
      "className",
      "style",
    ],
    img: [...(defaultSchema.attributes?.["img"] ?? []), "src", "alt", "title"],
    math: ["xmlns"],
    annotation: ["encoding"],
    code: ["className"],
    section: ["className", "dataFootnotes"],
    sup: ["className"],
    a: [
      ...(defaultSchema.attributes?.["a"] ?? []),
      "className",
      "dataFootnoteRef",
      "dataFootnoteBackref",
      "ariaDescribedby",
      "ariaLabel",
    ],
    li: [...(defaultSchema.attributes?.["li"] ?? []), "id"],
    input: ["type", "checked", "disabled"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "img",
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "msqrt",
    "mtext",
    "annotation",
    "mover",
    "munder",
    "mtable",
    "mtr",
    "mtd",
    "mpadded",
    "mspace",
    "mstyle",
    "menclose",
    "section",
    "input",
    "sup",
  ],
};

/** Transforms callout blockquotes (> [!type]) into styled divs. */
function preprocessCallouts(md: string): string {
  return md.replace(
    /^(> \[!(note|tip|warning|important|caution)\]\s*\n)((?:>.*\n?)*)/gim,
    (_match, _header: string, type: string, body: string) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const content = body.replace(/^>\s?/gm, "").trim();
      return `<div class="cork-callout cork-callout-${type.toLowerCase()}">\n<strong>${label}</strong>\n\n${content}\n</div>\n\n`;
    },
  );
}

/** Mermaid diagram component — renders fenced ```mermaid blocks. */
function MermaidBlock({ children }: { children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code = typeof children === "string"
    ? children
    : Array.isArray(children)
      ? children.map(String).join("")
      : String(children ?? "");

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
    mermaid.render(id, code.trim()).then(
      ({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      },
      (err) => {
        if (!cancelled) setError(String(err));
      },
    );
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <pre className="rounded-md border border-[var(--color-cork-danger-tint)] bg-[var(--color-cork-danger-tint)] px-3 py-2 text-[12px] text-[var(--color-cork-danger)]">
        Mermaid error: {error}
      </pre>
    );
  }

  if (!svg) {
    return <div className="py-4 text-center text-[12px] text-[var(--color-cork-muted)]">Rendering diagram...</div>;
  }

  return <div ref={containerRef} className="my-4 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Custom <pre> that intercepts mermaid code blocks. */
function PreBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  // children is a <code> element for fenced blocks
  const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;
  if (
    child &&
    typeof child === "object" &&
    "props" in child &&
    typeof child.props?.className === "string" &&
    child.props.className.includes("language-mermaid")
  ) {
    return <MermaidBlock>{child.props.children}</MermaidBlock>;
  }
  return <pre {...props}>{children}</pre>;
}

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** Rehype plugin that rewrites local image src to Tauri asset:// protocol URLs. */
function rehypeRewriteImages(vaultRoot: string, noteRelDir: string) {
  return () => (tree: HastNode) => {
    function visit(node: HastNode) {
      if (node.tagName === "img" && node.properties?.src) {
        const src = String(node.properties.src);
        const resolved = resolveAssetSrc(src, vaultRoot, noteRelDir);
        if (resolved) {
          node.properties.src = resolved;
        }
      }
      if (node.children) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}

function createProcessor(vaultRoot: string | null, noteRelDir: string) {
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, schema)
    .use(rehypeKatex);

  if (vaultRoot) {
    pipeline.use(rehypeRewriteImages(vaultRoot, noteRelDir));
  }

  return pipeline.use(rehypeReact, {
    jsx,
    jsxs,
    Fragment,
    components: {
      pre: PreBlock,
    },
  } as Parameters<typeof rehypeReact>[0]);
}

export function MarkdownPreview() {
  const body = useEditorStore((s) => s.body);
  const notePath = useEditorStore((s) => s.path);
  const vaultRoot = useVaultStore((s) => s.path);
  const [content, setContent] = useState<React.ReactNode>(null);

  // Derive the note's relative directory within the vault
  const noteRelDir = useMemo(() => {
    if (!notePath) return "";
    const parts = notePath.split("/");
    parts.pop(); // remove filename
    return parts.join("/");
  }, [notePath]);

  // Pre-process wikilinks and callouts before parsing
  const processed = useMemo(() => {
    if (!body) return "";
    // Rewrite Obsidian-style image embeds: ![[image.png]] → ![image.png](image.png)
    let md = body.replace(
      /!\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g,
      (_match, target: string, alias?: string) => `![${alias ?? target}](${target})`,
    );
    // Rewrite remaining wikilinks as bold
    md = md.replace(
      /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g,
      (_match, target: string, alias?: string) => `**${alias ?? target}**`,
    );
    md = preprocessCallouts(md);
    return md;
  }, [body]);

  useEffect(() => {
    let cancelled = false;
    const processor = createProcessor(vaultRoot, noteRelDir);
    processor.process(processed).then((file: { result: React.ReactNode }) => {
      if (!cancelled) setContent(file.result as React.ReactNode);
    });
    return () => { cancelled = true; };
  }, [processed, vaultRoot, noteRelDir]);

  return (
    <div className="cork-preview-scroll absolute inset-0 overflow-y-auto">
      <article className="cork-preview mx-auto max-w-[720px] px-10 py-6">
        {content}
      </article>
    </div>
  );
}
