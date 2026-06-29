/**
 * Conflict banner — shown when the file changed externally while dirty.
 *
 * @see F05 — Editor spec (conflict resolution)
 */

import { WarningCircle } from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";

export function ConflictBanner() {
  const forceReload = useEditorStore((s) => s.forceReload);
  const forceSave = useEditorStore((s) => s.forceSave);

  return (
    <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-[13px] dark:border-amber-700 dark:bg-amber-950">
      <WarningCircle size={16} className="shrink-0 text-amber-600" />
      <span className="flex-1 text-amber-800 dark:text-amber-200">
        This file was changed externally. Reload to see the latest version, or keep your changes.
      </span>
      <button
        onClick={() => void forceReload()}
        className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-200"
      >
        Reload
      </button>
      <button
        onClick={() => void forceSave()}
        className="rounded-md bg-amber-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-amber-700"
      >
        Keep my changes
      </button>
    </div>
  );
}
