import { useEditorStore } from "@/features/editor/state/editorStore";

export function SaveIndicator() {
  const buffer = useEditorStore((state) => (state.activeNoteId ? state.buffers.get(state.activeNoteId) : null));

  if (!buffer) {
    return null;
  }

  if (buffer.saveStatus === "saving") {
    return <span aria-label="Save status">Saving…</span>;
  }
  if (buffer.saveStatus === "error") {
    return <span aria-label="Save status">Save failed</span>;
  }
  if (buffer.dirty) {
    return <span aria-label="Save status">Unsaved changes</span>;
  }
  if (buffer.lastSavedAt) {
    return <span aria-label="Save status">Saved at {new Date(buffer.lastSavedAt).toLocaleTimeString()}</span>;
  }
  return <span aria-label="Save status">Saved</span>;
}
