/**
 * Shared unified/remark/rehype markdown pipeline.
 *
 * Extracted from MarkdownPreview so the preview (rehype-react) and note
 * export (rehype-stringify) render through the SAME processor setup —
 * GFM, math (KaTeX), callouts, footnotes, sanitize schema, checkbox
 * indexing, and local-image rewriting.
 *
 * @see F45 — Note Export spec (EXP-01)
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";

import { resolveAssetSrc } from "@/services/assetResolver";

export const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "style"],
    span: [...(defaultSchema.attributes?.["span"] ?? []), "className", "style"],
    div: [...(defaultSchema.attributes?.["div"] ?? []), "className", "style"],
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
    input: ["type", "checked", "disabled", "dataCbIndex"],
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

export type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/** Transforms callout blockquotes (> [!type]) into styled divs. */
export function preprocessCallouts(md: string): string {
  return md.replace(
    /^(> \[!(note|tip|warning|important|caution)\]\s*\n)((?:>.*\n?)*)/gim,
    (_match, _header: string, type: string, body: string) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1);
      const content = body.replace(/^>\s?/gm, "").trim();
      return `<div class="cork-callout cork-callout-${type.toLowerCase()}">\n<strong>${label}</strong>\n\n${content}\n</div>\n\n`;
    },
  );
}

/**
 * Pre-processes wikilinks, image embeds, and callouts before parsing:
 * `![[image.png]]` → `![image.png](image.png)`, `[[Note]]` → `**Note**`,
 * `> [!type]` blockquotes → callout divs.
 */
export function preprocessMarkdown(body: string): string {
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
  return preprocessCallouts(md);
}

/** Rehype plugin that assigns a sequential index to each task-list checkbox. */
export function rehypeIndexCheckboxes() {
  return () => (tree: HastNode) => {
    let idx = 0;
    function visit(node: HastNode) {
      if (node.tagName === "input" && node.properties?.type === "checkbox") {
        node.properties["data-cb-index"] = idx++;
        delete node.properties.disabled;
      }
      if (node.children) {
        for (const child of node.children) visit(child);
      }
    }
    visit(tree);
  };
}

/** Rehype plugin that rewrites local image src to Tauri asset:// protocol URLs. */
export function rehypeRewriteImages(vaultRoot: string, noteRelDir: string) {
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

/**
 * Builds the shared pipeline (parse → GFM → math → rehype → sanitize →
 * KaTeX → checkbox indexing → optional asset rewriting). Callers append
 * their own compiler (`rehype-react` for the preview, `rehype-stringify`
 * for export). Pass `vaultRoot: null` to skip asset:// image rewriting
 * (asset URLs only resolve inside the Tauri webview).
 */
export function createMarkdownPipeline(vaultRoot: string | null, noteRelDir: string) {
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeKatex)
    .use(rehypeIndexCheckboxes());

  if (vaultRoot) {
    pipeline.use(rehypeRewriteImages(vaultRoot, noteRelDir));
  }

  return pipeline;
}
