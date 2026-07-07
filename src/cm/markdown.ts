/**
 * CodeMirror markdown language configuration with GFM extensions.
 *
 * @see F05 — Editor spec
 */

import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { GFM } from "@lezer/markdown";

export function markdownExtension() {
  return markdown({
    base: markdownLanguage,
    codeLanguages: languages,
    extensions: [GFM],
  });
}
