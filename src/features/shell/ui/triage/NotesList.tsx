import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DotsThreeVertical, MagnifyingGlass, Star, Tag } from "@phosphor-icons/react";
import { createPortal } from "react-dom";

import { useDragRegion } from "@/shared/hooks/useDragRegion";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { useIndexStore } from "@/features/index/state/indexStore";
import { client } from "@/shared/ipc/client";
import type { NoteEntry } from "@/shared/ipc/types";

import type { SidebarFilter } from "./helpers";
import { formatRelativeDate } from "./helpers";
import { NoteContextMenu, MoveToSubmenu } from "./NoteContextMenu";
import type { ContextMenuState, MoveSubmenuState } from "./NoteContextMenu";

export function NotesList({ filter }: { filter: SidebarFilter }) {
  const allNotes = useVaultStore((s) => s.notes);
  const trashNote = useVaultStore((s) => s.trashNote);
  const moveNote = useVaultStore((s) => s.moveNote);
  const tags = useIndexStore((s) => s.tags);
  const noteTagMap = useIndexStore((s) => s.noteTagMap);
  const pinnedIds = useIndexStore((s) => s.pinnedIds);
  const toggleNotePin = useIndexStore((s) => s.toggleNotePin);
  const view = useShellStore((s) => s.view);
  const openNote = useShellStore((s) => s.openNote);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);

  const dragRef = useDragRegion<HTMLDivElement>();

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [moveSubmenu, setMoveSubmenu] = useState<MoveSubmenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      setCtxMenu(null);
      setMoveSubmenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (moveSubmenu) setMoveSubmenu(null);
        else setCtxMenu(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [ctxMenu, moveSubmenu]);

  const openCardMenu = useCallback((e: React.MouseEvent, note: NoteEntry) => {
    e.stopPropagation();
    setMoveSubmenu(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCtxMenu({ note, x: rect.right, y: rect.bottom + 4 });
  }, []);

  const handleMoveTo = useCallback(async () => {
    if (!ctxMenu) return;
    const diskFolders = await client.folders.list().catch((): string[] => []);
    const noteFolders = new Set(allNotes.map((n) => n.folder).filter(Boolean));
    const allFolders = [...new Set([...diskFolders, ...noteFolders])].sort();
    const available = allFolders.filter((f) => f !== ctxMenu.note.folder);
    const menuEl = menuRef.current;
    const x = menuEl ? menuEl.getBoundingClientRect().right + 2 : ctxMenu.x + 160;
    const y = ctxMenu.y;
    setMoveSubmenu({ folders: available, x, y });
  }, [ctxMenu, allNotes]);

  const handleMoveConfirm = useCallback(
    async (destFolder: string) => {
      if (!ctxMenu) return;
      try {
        await moveNote(ctxMenu.note.path, destFolder);
        toast.success(`Moved to "${destFolder}"`);
      } catch {
        toast.error("Failed to move note");
      }
      setCtxMenu(null);
      setMoveSubmenu(null);
    },
    [ctxMenu, moveNote],
  );

  const handleTrash = useCallback(async () => {
    if (!ctxMenu) return;
    try {
      await trashNote(ctxMenu.note.path);
      toast.success("Note moved to trash");
    } catch {
      toast.error("Failed to delete note");
    }
    setCtxMenu(null);
    setMoveSubmenu(null);
  }, [ctxMenu, trashNote]);

  const handleTogglePin = useCallback(async () => {
    if (!ctxMenu) return;
    const isPinned = pinnedIds.has(ctxMenu.note.id);
    try {
      await toggleNotePin(ctxMenu.note.id, ctxMenu.note.path);
      toast.success(isPinned ? "Unpinned" : "Pinned");
    } catch {
      toast.error("Failed to update pin");
    }
    setCtxMenu(null);
    setMoveSubmenu(null);
  }, [ctxMenu, pinnedIds, toggleNotePin]);

  const { notes, scopeLabel } = useMemo(() => {
    let filtered: NoteEntry[];
    let label: string;

    switch (filter.kind) {
      case "all":
        filtered = allNotes;
        label = "All";
        break;
      case "starred":
        filtered = allNotes.filter((n) => pinnedIds.has(n.id));
        label = "Pinned";
        break;
      case "inbox":
        filtered = allNotes.filter((n) => !n.folder || n.folder.toLowerCase() === "inbox");
        label = "Inbox";
        break;
      case "folder":
        filtered = allNotes.filter(
          (n) => n.folder === filter.id || n.folder.startsWith(filter.id + "/"),
        );
        label = filter.id;
        break;
      case "tag": {
        filtered = allNotes.filter((n) => noteTagMap.get(n.id)?.includes(filter.tag));
        const tagInfo = tags.find((t) => t.tag === filter.tag);
        label = `${filter.tag}${tagInfo ? ` · ${tagInfo.count}` : ""}`;
        break;
      }
    }

    return { notes: filtered, scopeLabel: label };
  }, [filter, allNotes, tags, noteTagMap, pinnedIds]);

  return (
    <section className="flex h-full flex-col border-r border-[var(--color-cork-border)] bg-[var(--color-cork-panel)]">
      <div
        ref={dragRef}
        className="flex h-12 items-center gap-2 border-b border-[var(--color-cork-border)] px-3"
      >
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-md bg-[var(--color-cork-panel-2)] px-2.5 py-1.5"
        >
          <MagnifyingGlass size={14} className="text-[var(--color-cork-muted)]" />
          <span className="flex-1 text-left text-sm text-[var(--color-cork-subtle)]">
            Search notes…
          </span>
          <kbd className="rounded border border-[var(--color-cork-border)] bg-[var(--color-cork-kbd)] px-1 text-[10px] font-medium text-[var(--color-cork-muted)]">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-3 text-xs text-[var(--color-cork-muted)]">
        <span>
          {scopeLabel} · {notes.length} notes
        </span>
        <button className="hover:text-[var(--color-cork-ink)]">Updated ▾</button>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {notes.map((n) => {
          const isActive = view.kind === "note" && view.id === n.id;
          const noteTags = noteTagMap.get(n.id) ?? [];
          return (
            <li key={n.id}>
              <div
                onClick={() => openNote(n.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openNote(n.id);
                }}
                className={`group flex w-full flex-col gap-1.5 border-l-[3px] px-4 py-3 text-left transition cursor-pointer ${
                  isActive
                    ? "border-[var(--color-cork-accent)] bg-[var(--color-cork-accent-soft)]"
                    : "border-transparent hover:bg-[var(--color-cork-panel-2)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {pinnedIds.has(n.id) && (
                      <Star size={10} weight="fill" className="shrink-0 text-amber-500" />
                    )}
                    <span className="truncate text-[13px] font-semibold text-[var(--color-cork-ink)]">
                      {n.title}
                    </span>
                  </div>
                  <button
                    onClick={(e) => openCardMenu(e, n)}
                    className="rounded p-0.5 text-[var(--color-cork-subtle)] opacity-0 transition-opacity hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)] group-hover:opacity-100"
                    title="Actions"
                  >
                    <DotsThreeVertical size={14} weight="bold" />
                  </button>
                </div>
                {n.snippet && (
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--color-cork-muted)]">
                    {n.snippet}
                  </p>
                )}
                {noteTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {noteTags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400"
                      >
                        <Tag size={8} />
                        {t}
                      </span>
                    ))}
                    {noteTags.length > 3 && (
                      <span className="rounded bg-[var(--color-cork-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--color-cork-subtle)]">
                        +{noteTags.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-cork-subtle)]">
                  <span>{formatRelativeDate(n.mtime)}</span>
                  <span>Created {formatRelativeDate(n.mtime)}</span>
                </div>
              </div>
            </li>
          );
        })}
        {notes.length === 0 && (
          <li className="px-4 py-8 text-center text-[12px] text-[var(--color-cork-subtle)]">
            No notes yet
          </li>
        )}
      </ul>

      {ctxMenu &&
        createPortal(
          <NoteContextMenu
            ref={menuRef}
            x={ctxMenu.x}
            y={ctxMenu.y}
            isPinned={pinnedIds.has(ctxMenu.note.id)}
            onTogglePin={() => void handleTogglePin()}
            onMoveTo={() => void handleMoveTo()}
            onTrash={() => void handleTrash()}
          />,
          document.body,
        )}

      {moveSubmenu &&
        createPortal(
          <MoveToSubmenu
            ref={submenuRef}
            x={moveSubmenu.x}
            y={moveSubmenu.y}
            folders={moveSubmenu.folders}
            onSelect={(folder) => void handleMoveConfirm(folder)}
          />,
          document.body,
        )}
    </section>
  );
}
