import type { HighlighterGeneric } from "shiki";

import { resolveActiveTheme } from "@/features/settings/runtime/themeRuntime";

type DevLang = "javascript" | "typescript" | "python" | "rust" | "shellscript" | "json" | "yaml" | "markdown";
type DevTheme = "vitesse-light" | "vitesse-dark";
type Highlighter = HighlighterGeneric<DevLang, DevTheme>;

let highlighterPromise: Promise<Highlighter> | null = null;

const langAliases = new Map<string, DevLang>([
  ["js", "javascript"],
  ["javascript", "javascript"],
  ["ts", "typescript"],
  ["typescript", "typescript"],
  ["py", "python"],
  ["python", "python"],
  ["rs", "rust"],
  ["rust", "rust"],
  ["sh", "shellscript"],
  ["bash", "shellscript"],
  ["shell", "shellscript"],
  ["json", "json"],
  ["yaml", "yaml"],
  ["yml", "yaml"],
  ["md", "markdown"],
  ["markdown", "markdown"],
]);

export async function highlightCode(code: string, lang = "text"): Promise<string> {
  const resolvedLang = langAliases.get(lang.toLowerCase());
  if (!resolvedLang) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
  try {
    const highlighter = await getHighlighter();
    const theme: DevTheme = resolveActiveTheme() === "dark" ? "vitesse-dark" : "vitesse-light";
    return highlighter.codeToHtml(code, { lang: resolvedLang, theme });
  } catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

async function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= import("shiki").then(({ createHighlighter }) =>
    createHighlighter({
      themes: ["vitesse-light", "vitesse-dark"],
      langs: ["javascript", "typescript", "python", "rust", "shellscript", "json", "yaml", "markdown"],
    }) as Promise<Highlighter>,
  );
  return highlighterPromise;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
