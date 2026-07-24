/**
 * CodeMirror 6 Markdown editor — the core editing surface.
 *
 * Loads the note buffer via editorStore, creates a CM6 EditorView,
 * and wires auto-save through the store's updateBody method.
 *
 * @see F05 — Editor spec
 */

import { useCallback, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { useEditorStore } from "@/stores/editorStore";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { createExtensions } from "@/cm/extensions";
import { setEditorView } from "@/cm/viewRef";
import { useVimModeStore } from "@/stores/vimModeStore";

import { ConflictBanner } from "./ConflictBanner";

export function Editor({ noteId, path }: { noteId: string; path: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const openBuffer = useEditorStore((s) => s.openBuffer);
  const body = useEditorStore((s) => s.body);
  const loading = useEditorStore((s) => s.loading);
  const conflict = useEditorStore((s) => s.conflict);
  const editorSettings = useAppSettingsStore((s) => s.settings.editor);

  // Stable callback for CM6 updates
  const onUpdate = useCallback((newBody: string) => {
    useEditorStore.getState().updateBody(newBody);
  }, []);

  // Load buffer when note changes
  useEffect(() => {
    void openBuffer(noteId, path);
    return () => {
      // Flush on unmount handled by closeBuffer in store
    };
  }, [noteId, path, openBuffer]);

  // Create/recreate CM6 view when body loads or settings change
  useEffect(() => {
    if (loading || !containerRef.current) return;

    // Destroy previous view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const extensions = createExtensions({
      lineWrap: editorSettings.lineWrap,
      showLineNumbers: editorSettings.showLineNumbers,
      tabSize: editorSettings.tabSize,
      vimMode: editorSettings.vimMode,
      livePreview: editorSettings.livePreview,
      onUpdate,
    });

    const state = EditorState.create({
      doc: body,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setEditorView(view);

    // Focus editor
    view.focus();

    // Consume a one-shot caret target (template {{cursor}} position)
    const pendingOffset = useEditorStore.getState().pendingCursorOffset;
    if (pendingOffset !== null) {
      view.dispatch({
        selection: { anchor: Math.min(pendingOffset, view.state.doc.length) },
        scrollIntoView: true,
      });
      useEditorStore.getState().setPendingCursorOffset(null);
    }

    // Track vim mode via getCM() vimState — much more reliable than DOM observation
    if (editorSettings.vimMode) {
      useVimModeStore.getState().setMode("NORMAL");
    }

    return () => {
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only recreate on note load, not on every body change
  }, [
    loading,
    noteId,
    editorSettings.lineWrap,
    editorSettings.showLineNumbers,
    editorSettings.tabSize,
    editorSettings.vimMode,
    editorSettings.livePreview,
    onUpdate,
  ]);

  // Sync external body changes (e.g., after reload) into CM6
  // This handles the case where forceReload updates the store body
  useEffect(() => {
    const view = viewRef.current;
    if (!view || loading) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== body && !useEditorStore.getState().dirty) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: body,
        },
      });
    }
  }, [body, loading]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[13px] text-[var(--color-cork-muted)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {conflict && <ConflictBanner />}
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          className="absolute inset-0 mx-auto max-w-[720px] px-10"
          style={{ fontSize: `${editorSettings.fontSize}px` }}
        />
      </div>
    </div>
  );
}
