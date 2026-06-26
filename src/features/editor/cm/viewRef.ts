/**
 * Shared EditorView reference — allows Inspector and other panels
 * to interact with the CodeMirror instance (scroll, focus, etc.).
 */

import type { EditorView } from "@codemirror/view";

let _view: EditorView | null = null;

export function setEditorView(view: EditorView | null) {
  _view = view;
}

export function getEditorView(): EditorView | null {
  return _view;
}
