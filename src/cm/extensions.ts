/**
 * Assembles all CodeMirror extensions for the Cork editor.
 *
 * @see F05 — Editor spec
 */

import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import type { Extension } from "@codemirror/state";

import { vim } from "@replit/codemirror-vim";

import { markdownExtension } from "./markdown";
import { corkEditorTheme, corkHighlighting } from "./theme";
import { wikilinkCompletion } from "./autocomplete";
import { wikilinkExtension } from "./wikilinks";
import { checkboxExtension } from "./checkboxes";
import { assetDropPaste } from "@/cm/dropPaste";
import { imagePreviewExtension } from "./imagePreview";

type EditorOptions = {
  lineWrap: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  vimMode: boolean;
  onUpdate: (body: string) => void;
};

export function createExtensions(options: EditorOptions): Extension[] {
  const extensions: Extension[] = [
    // Core editing
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    highlightSelectionMatches(),

    // Markdown language
    markdownExtension(),

    // Theme
    corkEditorTheme,
    corkHighlighting,

    // Autocomplete (wikilinks + tags)
    autocompletion({
      override: [wikilinkCompletion],
      activateOnTyping: true,
      maxRenderedOptions: 8,
    }),

    // Search
    // (search panel is activated by ⌘F via keymap)

    // Keymaps
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),

    // Wikilink decoration & click navigation
    wikilinkExtension(),

    // Interactive task checkboxes
    checkboxExtension(),

    // Asset drag-drop and clipboard paste
    assetDropPaste(),

    // Inline image preview below ![](…) and ![[…]] lines
    imagePreviewExtension(),

    // Fold gutter
    foldGutter(),

    // Update listener — sends body changes to the store
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onUpdate(update.state.doc.toString());
      }
    }),
  ];

  if (options.vimMode) {
    extensions.push(vim());
  }

  if (options.lineWrap) {
    extensions.push(EditorView.lineWrapping);
  }

  if (options.showLineNumbers) {
    extensions.push(lineNumbers());
  }

  // Tab size
  extensions.push(
    EditorView.editorAttributes.of({
      style: `tab-size: ${options.tabSize}`,
    }),
  );

  return extensions;
}
