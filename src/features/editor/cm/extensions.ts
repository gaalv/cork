import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";

import { concealedBrackets } from "./concealedBrackets";
import { headingSizes } from "./headingSizes";
import { tagCompletionSource } from "./tagAutocomplete";
import { noxeEditorTheme, noxeHighlightStyle } from "./theme";
import { wikilinkCompletionSource } from "./wikilinkAutocomplete";

import type { Extension } from "@codemirror/state";

export type EditorExtensionOptions = {
  extraExtensions?: Extension[];
};

export function createEditorExtensions(options: EditorExtensionOptions = {}): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    markdown(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    noxeHighlightStyle,
    headingSizes,
    concealedBrackets,
    autocompletion({ override: [wikilinkCompletionSource, tagCompletionSource] }),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorState.tabSize.of(2),
    EditorView.lineWrapping,
    noxeEditorTheme,
    ...(options.extraExtensions ?? []),
  ];
}
