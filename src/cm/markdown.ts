/**
 * CodeMirror markdown language configuration with GFM extensions.
 *
 * @see F05 — Editor spec
 */

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

export function markdownExtension() {
  return markdown({
    base: markdownLanguage,
    extensions: [GFM],
  });
}
