import { useState } from "react";

import { bulkOps } from "@/features/folder-ops/services/bulkOps";
import { useSelectionStore } from "@/features/folder-ops/state/selectionStore";
import { FolderPickerDialog } from "@/features/folder-ops/ui/FolderPickerDialog";

type BulkActionsBarProps = {
  folders: Array<{ id: string; name: string; count?: number }>;
  onDone?: () => Promise<void> | void;
};

export function BulkActionsBar({ folders, onDone }: BulkActionsBarProps) {
  const selectedPaths = useSelectionStore((state) => state.selectedPaths);
  const clear = useSelectionStore((state) => state.clear);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (selectedPaths.length === 0) {
    return null;
  }

  async function finish(action: () => Promise<{ ok: string[]; failed: unknown[] }>) {
    const result = await action();
    setStatus(result.failed.length > 0 ? `${result.ok.length} done, ${result.failed.length} failed` : `${result.ok.length} done`);
    clear();
    await onDone?.();
  }

  return (
    <div className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-2 text-[12px] shadow-xl">
      <strong>{selectedPaths.length} selected</strong>
      {status && <span className="text-[var(--color-noxe-muted)]">{status}</span>}
      <button className="rounded-full border border-[var(--color-noxe-border)] px-3 py-1 hover:border-[var(--color-noxe-border-strong)]" onClick={() => setPickerOpen(true)}>
        Move…
      </button>
      <button
        className="rounded-full border border-red-200 px-3 py-1 text-red-600 hover:bg-red-50"
        onClick={() => {
          if (window.confirm(`Delete ${selectedPaths.length} selected note${selectedPaths.length === 1 ? "" : "s"}?`)) {
            void finish(() => bulkOps.trash(selectedPaths));
          }
        }}
      >
        Delete
      </button>
      <button className="rounded-full px-3 py-1 hover:bg-[var(--color-noxe-panel-2)]" onClick={clear}>Cancel</button>
      <FolderPickerDialog
        folders={folders}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(folder) => {
          setPickerOpen(false);
          void finish(() => bulkOps.move(selectedPaths, folder));
        }}
      />
    </div>
  );
}
