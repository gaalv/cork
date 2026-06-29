import { forwardRef } from "react";
import { FolderSimple, Star, Trash } from "@phosphor-icons/react";

import { clampMenuPosition } from "@/utils/triageHelpers";

export type ContextMenuState = {
  note: {
    id: string;
    path: string;
    folder: string;
    title: string;
    snippet?: string;
    size: number;
    mtime: number;
  };
  x: number;
  y: number;
};
export type MoveSubmenuState = { folders: string[]; x: number; y: number };

export const NoteContextMenu = forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    isPinned: boolean;
    onTogglePin: () => void;
    onMoveTo: () => void;
    onTrash: () => void;
  }
>(function NoteContextMenu({ x, y, isPinned, onTogglePin, onMoveTo, onTrash }, ref) {
  const style = clampMenuPosition(x, y, 176, 120);

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 w-44 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-xl"
    >
      <button
        onClick={onTogglePin}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <Star
          size={14}
          weight={isPinned ? "fill" : "regular"}
          className="text-[var(--color-cork-muted)]"
        />
        {isPinned ? "Unpin" : "Pin"}
      </button>
      <button
        onClick={onMoveTo}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <FolderSimple size={14} className="text-[var(--color-cork-muted)]" />
        Move to…
      </button>
      <div className="mx-2 border-t border-[var(--color-cork-border)]" />
      <button
        onClick={onTrash}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
      >
        <Trash size={14} />
        Delete
      </button>
    </div>
  );
});

export const MoveToSubmenu = forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    folders: string[];
    onSelect: (folder: string) => void;
  }
>(function MoveToSubmenu({ x, y, folders, onSelect }, ref) {
  const style = clampMenuPosition(x, y, 200, Math.min(folders.length * 32 + 8, 280));

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 w-50 max-h-[280px] overflow-y-auto rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-xl"
    >
      {folders.length === 0 && (
        <div className="px-2.5 py-2 text-[12px] text-[var(--color-cork-subtle)]">
          No folders available
        </div>
      )}
      {folders.map((f) => (
        <button
          key={f}
          onClick={() => onSelect(f)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
        >
          <FolderSimple size={14} className="text-[var(--color-cork-muted)]" />
          <span className="truncate">{f}</span>
        </button>
      ))}
    </div>
  );
});
