import { forwardRef } from "react";
import {
  Archive,
  CaretRight,
  Check,
  CircleDashed,
  FolderSimple,
  Star,
  Trash,
} from "@phosphor-icons/react";

import { cn } from "@/utils/cn";
import { NOTE_STATUSES, NOTE_STATUS_META } from "@/utils/noteStatus";
import { clampMenuPosition } from "@/utils/triageHelpers";
import type { NoteStatus } from "@/ipc/types";

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
    onStatus: () => void;
    onMoveTo: () => void;
    onArchive: () => void;
    onTrash: () => void;
  }
>(function NoteContextMenu(
  { x, y, isPinned, onTogglePin, onStatus, onMoveTo, onArchive, onTrash },
  ref,
) {
  const style = clampMenuPosition(x, y, 176, 180);

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
        onClick={onStatus}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <CircleDashed size={14} className="text-[var(--color-cork-muted)]" />
        Status
        <CaretRight size={12} className="ml-auto text-[var(--color-cork-subtle)]" />
      </button>
      <button
        onClick={onMoveTo}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <FolderSimple size={14} className="text-[var(--color-cork-muted)]" />
        Move to…
      </button>
      <button
        onClick={onArchive}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <Archive size={14} className="text-[var(--color-cork-muted)]" />
        Archive
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

export const StatusSubmenu = forwardRef<
  HTMLDivElement,
  {
    x: number;
    y: number;
    current: NoteStatus | undefined;
    onSelect: (status: NoteStatus | null) => void;
  }
>(function StatusSubmenu({ x, y, current, onSelect }, ref) {
  const style = clampMenuPosition(x, y, 160, 140);

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 w-40 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-xl"
    >
      {NOTE_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
        >
          <span className={cn("h-2 w-2 shrink-0 rounded-full", NOTE_STATUS_META[s].dotClass)} />
          {NOTE_STATUS_META[s].label}
          {current === s && <Check size={12} className="ml-auto text-[var(--color-cork-accent)]" />}
        </button>
      ))}
      <div className="mx-2 border-t border-[var(--color-cork-border)]" />
      <button
        onClick={() => onSelect(null)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[12px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)]"
      >
        <span className="h-2 w-2 shrink-0 rounded-full border border-[var(--color-cork-subtle)]" />
        None
        {current === undefined && (
          <Check size={12} className="ml-auto text-[var(--color-cork-accent)]" />
        )}
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
