import { useEffect, useMemo, useRef } from "react";
import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { createEditorDropPasteExtension } from "@/features/assets/hooks/useEditorDropPaste";
import { createEditorExtensions } from "@/features/editor/cm/extensions";
import { useEditorStore } from "@/features/editor/state/editorStore";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";

import type { Extension } from "@codemirror/state";

export type EditorProps = {
  className?: string;
  extraExtensions?: Extension[];
  onReady?: (view: EditorView) => void;
};

export function Editor({ className, extraExtensions = [], onReady }: EditorProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const activeNoteId = useEditorStore((state) => state.activeNoteId);
  const buffer = useEditorStore((state) => (state.activeNoteId ? state.buffers.get(state.activeNoteId) : null));
  const updateBody = useEditorStore((state) => state.updateBody);
  const editorSettings = useAppSettingsStore((state) => state.settings.editor);
  const extensions = useMemo(
    () => [
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }
        const noteId = useEditorStore.getState().activeNoteId;
        if (noteId) {
          updateBody(noteId, update.state.doc.toString());
        }
      }),
      ...createEditorExtensions({
        extraExtensions: [createEditorDropPasteExtension(), ...extraExtensions],
        lineWrap: editorSettings.lineWrap,
        showLineNumbers: editorSettings.showLineNumbers,
        fontFamily: editorSettings.fontFamily,
        fontSize: editorSettings.fontSize,
        tabSize: editorSettings.tabSize,
      }),
    ],
    [editorSettings.fontFamily, editorSettings.fontSize, editorSettings.lineWrap, editorSettings.showLineNumbers, editorSettings.tabSize, extraExtensions, updateBody],
  );

  useEffect(() => {
    if (!parentRef.current || viewRef.current || !buffer) {
      return;
    }

    const view = new EditorView({
      parent: parentRef.current,
      state: EditorState.create({ doc: buffer.body, extensions }),
    });
    viewRef.current = view;
    onReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [buffer, extensions, onReady]);

  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({ effects: StateEffect.reconfigure.of(extensions) });
    }
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !buffer) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== buffer.body) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: buffer.body } });
    }
  }, [activeNoteId, buffer]);

  return (
    <section className={className} data-testid="editor" aria-label="Markdown editor">
      {buffer ? <div ref={parentRef} className="h-full min-h-0" /> : <p>No note selected</p>}
    </section>
  );
}
