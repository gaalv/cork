/**
 * BulkActionsBar — floating action bar for multi-select note operations.
 *
 * @see F08 — Folder Management spec
 */

import { useState } from "react";
import { FolderSimple, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useBulkSelection } from "@/hooks/useBulkSelection";
import { bulkOps } from "@/services/bulkOps";

export function BulkActionsBar({
  folders,
  onDone,
}: {
  folders: { id: string; name: string; count: number }[];
  onDone: () => void;
}) {
  const { selected, clear } = useBulkSelection();
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  if (selected.size === 0) return null;

  const paths = [...selected];

  const handleTrash = async () => {
    try {
      await bulkOps.trash(paths);
      toast.success(`${paths.length} note(s) moved to trash`);
      clear();
      onDone();
    } catch {
      toast.error("Failed to move notes to trash");
    }
  };

  const handleMove = async (destFolder: string) => {
    try {
      await bulkOps.move(paths, destFolder);
      toast.success(`${paths.length} note(s) moved to ${destFolder}`);
      clear();
      setMoveTarget(null);
      onDone();
    } catch {
      toast.error("Failed to move notes");
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] px-4 py-2.5 shadow-xl">
      <span className="text-[13px] font-medium">{selected.size} selected</span>

      <div className="h-4 w-px bg-[var(--color-cork-border)]" />

      {moveTarget === null ? (
        <button
          onClick={() => setMoveTarget("")}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
        >
          <FolderSimple size={14} /> Move to...
        </button>
      ) : (
        <select
          autoFocus
          value=""
          onChange={(e) => {
            if (e.target.value) void handleMove(e.target.value);
          }}
          onBlur={() => setMoveTarget(null)}
          className="rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[12px]"
        >
          <option value="">Select folder...</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() => void handleTrash()}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-red-600 hover:bg-red-50"
      >
        <Trash size={14} /> Trash
      </button>

      <button
        onClick={clear}
        className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <X size={12} />
      </button>
    </div>
  );
}
