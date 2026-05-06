import { useEditorStore } from "@/features/editor/state/editorStore";

export type ConflictBannerProps = {
  onDiff?: () => void;
};

export function ConflictBanner({ onDiff }: ConflictBannerProps) {
  const noteId = useEditorStore((state) => state.activeNoteId);
  const conflict = useEditorStore((state) => (state.activeNoteId ? state.buffers.get(state.activeNoteId)?.conflict : null));
  const resolveConflict = useEditorStore((state) => state.resolveConflict);

  if (!noteId || !conflict) {
    return null;
  }

  return (
    <section role="alert" className="rounded-lg border px-3 py-2">
      <p>File changed externally. Reload from disk or keep my changes?</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => resolveConflict(noteId, "reload")}>
          Reload from disk
        </button>
        <button type="button" onClick={() => resolveConflict(noteId, "keep")}>
          Keep mine
        </button>
        <button type="button" onClick={onDiff}>
          Diff
        </button>
      </div>
    </section>
  );
}
