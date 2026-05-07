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
import { liveLinkClick } from "./liveLinkClick";
import { liveMarkdownDecorations } from "./liveMarkdownDecorations";
import { liveModeFacet } from "./liveModeFacet";
import { searchExtension } from "./searchExtension";
import { slashCompletionSource } from "./slashMenu";
import { tagCompletionSource } from "./tagAutocomplete";
import { noxeEditorTheme, noxeHighlightStyle } from "./theme";
import { wikilinkCompletionSource } from "./wikilinkAutocomplete";

import type { Extension } from "@codemirror/state";
import type { LiveMode } from "./liveModeFacet";

export type EditorExtensionOptions = {
  extraExtensions?: Extension[];
  lineWrap?: boolean;
  showLineNumbers?: boolean;
  fontFamily?: string;
  fontSize?: number;
  tabSize?: number;
  liveMode?: LiveMode;
};

export function createEditorExtensions(options: EditorExtensionOptions = {}): Extension[] {
  const showLineNumbers = options.showLineNumbers ?? true;
  const tabSize = options.tabSize ?? 2;
  return [
    liveModeFacet.of(options.liveMode ?? "live"),
    ...(showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []),
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
    liveMarkdownDecorations,
    liveLinkClick,
    searchExtension,
    autocompletion({ override: [wikilinkCompletionSource, tagCompletionSource, slashCompletionSource] }),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorState.tabSize.of(tabSize),
    ...(options.lineWrap ?? true ? [EditorView.lineWrapping] : []),
    editorFontTheme(options.fontFamily, options.fontSize),
    noxeEditorTheme,
    ...(options.extraExtensions ?? []),
  ];
}

function editorFontTheme(fontFamily = "system-ui", fontSize = 14): Extension {
  return EditorView.theme({
    "& .cm-content": {
      fontFamily,
      fontSize: `${fontSize}px`,
    },
  });
}
