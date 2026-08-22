/**
 * Programmatic edits to the open note.
 *
 * While the editor is mounted, CodeMirror's document is the source of truth —
 * not the store. Writing to the store directly looks like it works (the note
 * even autosaves) but the editor never picks the change up: its sync effect
 * deliberately refuses to overwrite a dirty buffer, so the screen keeps the
 * old text while the file on disk gets the new one. The next keystroke then
 * pushes the stale document back over the save.
 *
 * Everything that rewrites the body from outside the editor — AI skills,
 * generated content, checkbox toggles in the preview — goes through here.
 */

import { getEditorView } from "@/cm/viewRef";
import { useEditorStore } from "@/stores/editorStore";

/**
 * Replace the whole body.
 *
 * Dispatches through the editor when one is mounted, so the change is visible
 * and the store is updated by the usual update listener. Falls back to the
 * store in preview mode, where no editor exists and the buffer is rebuilt from
 * it on the way back.
 */
export function replaceNoteBody(next: string): void {
  const view = getEditorView();
  if (!view) {
    useEditorStore.getState().updateBody(next);
    return;
  }

  const current = view.state.doc.toString();
  if (current === next) return;

  // Keep the caret roughly where the writer left it rather than snapping to 0.
  const head = view.state.selection.main.head;
  view.dispatch({
    changes: { from: 0, to: current.length, insert: next },
    selection: { anchor: Math.min(head, next.length) },
  });
}

/** Append a block to the end of the body, separated by a blank line. */
export function appendToNoteBody(block: string): void {
  const view = getEditorView();
  const current = view ? view.state.doc.toString() : useEditorStore.getState().body;
  replaceNoteBody(`${current.trimEnd()}\n\n${block.trim()}\n`);
}
