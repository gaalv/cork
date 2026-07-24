/**
 * Note export (F45) — HTML file, PDF via print, and copy-as-markdown.
 *
 * All three operate on the currently open note. HTML/PDF render the body
 * through the SAME shared pipeline the preview uses (markdownProcessor),
 * compiled to a string with rehype-stringify.
 *
 * Documented v1 choices (see spec):
 * - PDF (EXP-02): no offscreen render — we inject a print-only copy of the
 *   rendered note into the DOM and call `window.print()`; the user picks
 *   "Save as PDF" in the WebView print dialog.
 * - KaTeX CSS: NOT inlined (the full stylesheet needs bundled woff2 fonts).
 *   Instead the export stylesheet hides KaTeX's HTML layer and lets the
 *   MathML output render natively — supported by all modern browsers.
 * - Images: asset:// rewriting is skipped (those URLs only resolve inside
 *   the Tauri webview); relative srcs are kept as written, so images
 *   resolve if the file is saved next to them, and degrade to alt text
 *   otherwise. No external requests are introduced either way.
 * - Mermaid: fenced ```mermaid blocks export as plain code blocks (the
 *   diagram renderer is a React component outside the shared pipeline).
 */

import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";

/**
 * Standalone light-theme stylesheet for exported/printed notes.
 * Deliberately self-contained (system font stack, literal colors — app
 * theme tokens don't exist outside the webview), mirroring the in-app
 * `.cork-preview` styles from index.css.
 */
const EXPORT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .cork-preview {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 24px;
    color: #1a1a1a;
    font-size: 14px;
    line-height: 1.7;
  }
  .cork-preview h1, .cork-preview h2, .cork-preview h3,
  .cork-preview h4, .cork-preview h5, .cork-preview h6 {
    color: #1a1a1a;
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    line-height: 1.3;
  }
  .cork-preview h1 { font-size: 1.6em; }
  .cork-preview h2 { font-size: 1.35em; }
  .cork-preview h3 { font-size: 1.15em; }
  .cork-preview p { margin: 0.75em 0; }
  .cork-preview a { color: #4667de; text-decoration: underline; text-underline-offset: 2px; }
  .cork-preview strong { color: #1a1a1a; font-weight: 600; }
  .cork-preview em { font-style: italic; }
  .cork-preview code {
    background: #f2f2f0;
    border-radius: 4px;
    padding: 0.15em 0.35em;
    font-size: 0.85em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .cork-preview pre {
    background: #f2f2f0;
    border-radius: 8px;
    padding: 0.75em 1em;
    overflow-x: auto;
    margin: 1em 0;
  }
  .cork-preview pre code { background: none; padding: 0; font-size: 0.85em; }
  .cork-preview blockquote {
    border-left: 3px solid #4667de;
    padding-left: 1em;
    margin: 1em 0;
    color: #6b6b6b;
  }
  .cork-preview ul, .cork-preview ol { padding-left: 1.5em; margin: 0.5em 0; }
  .cork-preview li { margin: 0.25em 0; }
  .cork-preview ul { list-style-type: disc; }
  .cork-preview ol { list-style-type: decimal; }
  .cork-preview hr { border: none; border-top: 1px solid #e4e4e1; margin: 1.5em 0; }
  .cork-preview table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.9em; }
  .cork-preview th, .cork-preview td {
    border: 1px solid #e4e4e1;
    padding: 0.4em 0.75em;
    text-align: left;
  }
  .cork-preview th { background: #f2f2f0; font-weight: 600; }
  .cork-preview img { max-width: 100%; border-radius: 8px; margin: 1em 0; }
  .cork-callout {
    border-left: 3px solid #4667de;
    border-radius: 0 8px 8px 0;
    background: #f2f2f0;
    padding: 0.75em 1em;
    margin: 1em 0;
  }
  .cork-callout strong {
    display: block;
    margin-bottom: 0.25em;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .cork-callout-tip { border-left-color: #2e9e5b; }
  .cork-callout-warning, .cork-callout-caution { border-left-color: #d64545; }
  .cork-callout-important { border-left-color: #4667de; }
  .cork-preview section[data-footnotes] {
    border-top: 1px solid #e4e4e1;
    margin-top: 2em;
    padding-top: 1em;
    font-size: 0.85em;
    color: #6b6b6b;
  }
  .cork-preview li > input[type="checkbox"] { margin-right: 0.4em; accent-color: #4667de; }
  /* KaTeX without its stylesheet: hide the HTML layer, render native MathML. */
  .cork-preview .katex-html { display: none; }
  .cork-preview .katex-display { margin: 1em 0; text-align: center; overflow-x: auto; }
`;

type OpenNote = { title: string; body: string };

/** Resolves the open note (shell view + vault list + editor buffer). */
function getOpenNote(): OpenNote | null {
  const view = useShellStore.getState().view;
  if (view.kind !== "note") return null;
  const entry = useVaultStore.getState().notes.find((n) => n.id === view.id);
  const { body, loading } = useEditorStore.getState();
  if (!entry || loading) return null;
  return { title: entry.title, body };
}

/** Renders the note body to an HTML string through the shared pipeline. */
async function renderNoteBodyHtml(body: string): Promise<string> {
  // Dynamic import keeps the heavy unified/remark/rehype/katex pipeline out
  // of the main chunk — this service is reached from the eager CommandPalette.
  const [{ createMarkdownPipeline, preprocessMarkdown }, { default: rehypeStringify }] =
    await Promise.all([import("@/utils/markdownProcessor"), import("rehype-stringify")]);
  // vaultRoot: null — skip asset:// image rewriting (see module docs).
  const processor = createMarkdownPipeline(null, "").use(rehypeStringify);
  const file = await processor.process(preprocessMarkdown(body));
  return String(file);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildStandaloneHtml(title: string, bodyHtml: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${EXPORT_STYLES}</style>`,
    "</head>",
    "<body>",
    `<article class="cork-preview">${bodyHtml}</article>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function sanitizeFilename(title: string): string {
  const cleaned = title.replace(/[/\\:*?"<>|]/g, "-").trim();
  return cleaned || "note";
}

/** EXP-01 — Export the open note as a self-contained HTML file. */
export async function exportNoteAsHtml(): Promise<void> {
  const note = getOpenNote();
  if (!note) return;

  try {
    const bodyHtml = await renderNoteBodyHtml(note.body);
    const html = buildStandaloneHtml(note.title, bodyHtml);

    const path = await save({
      defaultPath: `${sanitizeFilename(note.title)}.html`,
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (!path) return; // user cancelled

    await client.export.write(path, html);
    toast.success("Note exported as HTML");
  } catch (err) {
    toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * EXP-02 — Export the open note as PDF.
 *
 * v1 choice (per spec): no hidden/offscreen render. We inject the rendered
 * note plus a print stylesheet that hides the app UI, then trigger the
 * WebView print dialog with `window.print()` — the user picks "Save as PDF".
 */
export async function exportNoteAsPdf(): Promise<void> {
  const note = getOpenNote();
  if (!note) return;

  try {
    const bodyHtml = await renderNoteBodyHtml(note.body);

    const container = document.createElement("div");
    container.id = "cork-print-export";
    // The <style> is document-global: on screen the export copy stays
    // hidden; in print everything EXCEPT the export copy is hidden.
    container.innerHTML =
      `<style>` +
      `#cork-print-export { display: none; }` +
      `@media print {` +
      `  body > *:not(#cork-print-export) { display: none !important; }` +
      `  #cork-print-export { display: block; }` +
      `  ${EXPORT_STYLES}` +
      `}` +
      `</style>` +
      `<article class="cork-preview"></article>`;
    // bodyHtml is sanitized by rehype-sanitize in the shared pipeline.
    const article = container.querySelector("article");
    if (article) article.innerHTML = bodyHtml;
    document.body.appendChild(container);

    const cleanup = () => container.remove();
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Fallback in case afterprint never fires in the webview.
    setTimeout(cleanup, 60_000);
  } catch (err) {
    toast.error(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** EXP-03 — Copy the raw note body (frontmatter already stripped) to the clipboard. */
export async function copyNoteAsMarkdown(): Promise<void> {
  const note = getOpenNote();
  if (!note) return;

  try {
    // editorStore.body is the frontmatter-stripped body (notes.read splits
    // frontmatter into its own field), so this is exactly the raw markdown.
    await navigator.clipboard.writeText(note.body);
    toast.success("Markdown copied to clipboard");
  } catch (err) {
    toast.error(`Copy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
