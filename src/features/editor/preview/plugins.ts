import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";

import { remarkWikilink } from "./remarkWikilink";

export const baseRemarkPlugins = [remarkFrontmatter, remarkGfm, remarkWikilink];
export const baseRehypePlugins = [rehypeRaw, rehypeSanitize];
