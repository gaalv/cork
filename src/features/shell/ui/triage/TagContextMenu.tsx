import { forwardRef, useEffect, useRef, useState } from "react";
import { Pencil, Trash } from "@phosphor-icons/react";

import { clampMenuPosition } from "./helpers";

export const TagContextMenu = forwardRef<
  HTMLDivElement,
  {
    tag: string;
    x: number;
    y: number;
    onRename: (newName: string) => void;
    onDelete: () => void;
  }
>(function TagContextMenu({ tag, x, y, onRename, onDelete }, ref) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(tag);
  const renameRef = useRef<HTMLInputElement>(null);
  const style = clampMenuPosition(x, y, 160, renaming ? 80 : 72);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  if (renaming) {
    return (
      <div ref={ref} style={style} className="fixed z-50 w-48 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] p-2 shadow-xl">
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value.replace(/\s/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && renameValue.trim()) onRename(renameValue.trim());
            if (e.key === "Escape") setRenaming(false);
          }}
          className="w-full rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-2 py-1 text-[12px] outline-none focus:border-[var(--color-cork-tag)]"
        />
        <div className="mt-1.5 flex justify-end gap-1">
          <button onClick={() => setRenaming(false)} className="rounded px-2 py-0.5 text-[11px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]">Cancel</button>
          <button
            onClick={() => { if (renameValue.trim()) onRename(renameValue.trim()); }}
            disabled={!renameValue.trim()}
            className="rounded bg-[var(--color-cork-tag)] px-2 py-0.5 text-[11px] text-white disabled:opacity-40"
          >
            Rename
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} style={style} className="fixed z-50 w-40 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-xl">
      <button
        onClick={() => setRenaming(true)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <Pencil size={14} className="text-[var(--color-cork-muted)]" />
        Rename
      </button>
      <button
        onClick={onDelete}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
      >
        <Trash size={14} />
        Delete
      </button>
    </div>
  );
});
