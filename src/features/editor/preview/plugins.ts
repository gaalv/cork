import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

import { katexRehypePlugin, katexRemarkPlugin } from "./katexRenderer";

import { remarkWikilink } from "./remarkWikilink";

export const baseRemarkPlugins = [remarkFrontmatter, remarkGfm, katexRemarkPlugin, remarkWikilink];
export const baseRehypePlugins = [rehypeRaw, rehypeSanitize, katexRehypePlugin];
