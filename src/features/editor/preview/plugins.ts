import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

import { katexRehypePlugin, katexRemarkPlugin } from "./katexRenderer";

import { rehypeFootnotes } from "./rehypeFootnotes";
import { remarkCallouts } from "./remarkCallouts";
import { remarkWikilink } from "./remarkWikilink";

import type { PluggableList } from "unified";

const markdownSanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [...(defaultSchema.tagNames ?? []), "aside", "header", "mark"],
  attributes: {
    ...defaultSchema.attributes,
    aside: ["className", "dataKind"],
    header: ["className"],
    mark: ["className"],
    section: ["className"],
  },
};

export const baseRemarkPlugins: PluggableList = [remarkFrontmatter, remarkGfm, katexRemarkPlugin, remarkCallouts, remarkWikilink];
export const baseRehypePlugins: PluggableList = [rehypeRaw, rehypeFootnotes, [rehypeSanitize, markdownSanitizeSchema], katexRehypePlugin];
