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

import { vim, getCM } from "@replit/codemirror-vim";

import { livePreviewExtension } from "./livePreview";
import { markdownExtension } from "./markdown";
import { corkEditorTheme, corkHighlighting } from "./theme";
import { wikilinkCompletion } from "./autocomplete";
import { useVimModeStore, type VimMode } from "@/stores/vimModeStore";
import { wikilinkExtension } from "./wikilinks";
import { checkboxExtension } from "./checkboxes";
import { assetDropPaste } from "@/cm/dropPaste";
import { imagePreviewExtension } from "./imagePreview";

type EditorOptions = {
  lineWrap: boolean;
  showLineNumbers: boolean;
  tabSize: number;
  vimMode: boolean;
  livePreview: boolean;
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

  if (options.livePreview) {
    extensions.push(livePreviewExtension());
  }

  if (options.vimMode) {
    extensions.push(vim());
    // Detect vim mode changes and sync to store for status bar
    let lastMode: VimMode = "NORMAL";
    extensions.push(
      EditorView.updateListener.of((update) => {
        const cm = getCM(update.view);
        if (!cm) return;
        const vs = (
          cm.state as { vim?: { insertMode?: boolean; visualMode?: boolean; mode?: string } }
        ).vim;
        if (!vs) return;
        let mode: VimMode = "NORMAL";
        if (vs.insertMode) mode = "INSERT";
        else if (vs.visualMode) mode = "VISUAL";
        else if (vs.mode === "replace") mode = "REPLACE";
        if (mode !== lastMode) {
          lastMode = mode;
          useVimModeStore.getState().setMode(mode);
        }
      }),
    );
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
