import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";

import { calloutHintExtension } from "./calloutHint";
import { concealedBrackets } from "./concealedBrackets";
import { footnoteDefExtension } from "./footnoteDef";
import { headingSizes } from "./headingSizes";
import { highlightMarkExtension } from "./highlightMark";
import { searchExtension } from "./searchExtension";
import { slashCompletionSource } from "./slashMenu";
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
    calloutHintExtension,
    footnoteDefExtension,
    highlightMarkExtension,
    concealedBrackets,
    searchExtension,
    autocompletion({ override: [wikilinkCompletionSource, tagCompletionSource, slashCompletionSource] }),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorState.tabSize.of(2),
    EditorView.lineWrapping,
    noxeEditorTheme,
    ...(options.extraExtensions ?? []),
  ];
}
