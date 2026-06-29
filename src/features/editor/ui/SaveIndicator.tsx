/**
 * Save indicator — shows save state in the bottom-right corner.
 *
 * @see F05 — Editor spec
 */

import { useEditorStore } from "@/features/editor/state/editorStore";

export function SaveIndicator() {
  const dirty = useEditorStore((s) => s.dirty);
  const saving = useEditorStore((s) => s.saving);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const error = useEditorStore((s) => s.error);

  let label: string;
  let color: string;

  if (error) {
    label = "Save failed";
    color = "text-red-500";
  } else if (saving) {
    label = "Saving...";
    color = "text-[var(--color-cork-muted)]";
  } else if (dirty) {
    label = "Unsaved";
    color = "text-[var(--color-cork-muted)]";
  } else if (lastSavedAt) {
    label = "Saved";
    color = "text-[var(--color-cork-subtle)]";
  } else {
    return null;
  }

  return <div className={`absolute right-4 bottom-4 text-[11px] ${color}`}>{label}</div>;
}
