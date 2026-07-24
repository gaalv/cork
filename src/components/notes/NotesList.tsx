import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import {
  ArrowCounterClockwise,
  CircleNotch,
  DotsThreeVertical,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  SidebarSimple,
  SortAscending,
  SortDescending,
  Star,
  Tag,
} from "@phosphor-icons/react";
import { createPortal } from "react-dom";

import { useDragRegion } from "@/hooks/useDragRegion";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { useIndexStore } from "@/stores/indexStore";
import { client } from "@/ipc/client";
import type { ArchivedNoteEntry, NoteEntry } from "@/ipc/types";

import type { SidebarFilter } from "@/utils/triageHelpers";
import { formatRelativeDate } from "@/utils/triageHelpers";
import { NOTE_STATUS_META } from "@/utils/noteStatus";
import { NoteContextMenu, MoveToSubmenu, StatusSubmenu } from "./NoteContextMenu";
import type { ContextMenuState, MoveSubmenuState } from "./NoteContextMenu";
import type { NoteStatus } from "@/ipc/types";
import { StatusBadge } from "./StatusBadge";
import { createNote } from "@/services/createNote";

export function NotesList({ filter }: { filter: SidebarFilter }) {
  const allNotes = useVaultStore((s) => s.notes);
  const isLoading = useVaultStore((s) => s.isLoading);
  const moveNote = useVaultStore((s) => s.moveNote);
  const tags = useIndexStore((s) => s.tags);
  const noteTagMap = useIndexStore((s) => s.noteTagMap);
  const pinnedIds = useIndexStore((s) => s.pinnedIds);
  const toggleNotePin = useIndexStore((s) => s.toggleNotePin);
  const statusById = useIndexStore((s) => s.statusById);
  const setNoteStatus = useIndexStore((s) => s.setNoteStatus);
  const isIndexing = useIndexStore((s) => s.isIndexing);
  const indexProgress = useIndexStore((s) => s.indexProgress);
  const view = useShellStore((s) => s.view);
  const openNote = useShellStore((s) => s.openNote);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const sidebarOpen = useShellStore((s) => s.sidebarOpen);
  const toggleSidebar = useShellStore((s) => s.toggleSidebar);

  const dragRef = useDragRegion<HTMLDivElement>();

  const [sortOrder, setSortOrder] = useState<"updated" | "created" | "title">("updated");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const [archivedNotes, setArchivedNotes] = useState<ArchivedNoteEntry[]>([]);
  const loadNotes = useVaultStore((s) => s.loadNotes);

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [moveSubmenu, setMoveSubmenu] = useState<MoveSubmenuState | null>(null);
  const [statusSubmenu, setStatusSubmenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const statusSubmenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filter.kind === "archived") {
      void client.archive
        .list()
        .then(setArchivedNotes)
        .catch(() => setArchivedNotes([]));
    }
  }, [filter]);

  useEffect(() => {
    if (!ctxMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      if (statusSubmenuRef.current?.contains(target)) return;
      setCtxMenu(null);
      setMoveSubmenu(null);
      setStatusSubmenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (moveSubmenu) setMoveSubmenu(null);
        else if (statusSubmenu) setStatusSubmenu(null);
        else setCtxMenu(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [ctxMenu, moveSubmenu, statusSubmenu]);

  useEffect(() => {
    if (!filterMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (filterBtnRef.current?.contains(target)) return;
      if (filterMenuRef.current?.contains(target)) return;
      setFilterMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterMenuOpen]);

  const openCardMenu = useCallback((e: React.MouseEvent, note: NoteEntry) => {
    e.stopPropagation();
    setMoveSubmenu(null);
    setStatusSubmenu(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCtxMenu({ note, x: rect.right, y: rect.bottom + 4 });
  }, []);

  const handleStatusTo = useCallback(() => {
    if (!ctxMenu) return;
    setMoveSubmenu(null);
    const menuEl = menuRef.current;
    const x = menuEl ? menuEl.getBoundingClientRect().right + 2 : ctxMenu.x + 160;
    setStatusSubmenu({ x, y: ctxMenu.y });
  }, [ctxMenu]);

  const handleStatusSelect = useCallback(
    async (status: NoteStatus | null) => {
      if (!ctxMenu) return;
      await setNoteStatus(ctxMenu.note.id, ctxMenu.note.path, status);
      setCtxMenu(null);
      setStatusSubmenu(null);
    },
    [ctxMenu, setNoteStatus],
  );

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

  const handleArchive = useCallback(async () => {
    if (!ctxMenu) return;
    try {
      await client.archive.note(ctxMenu.note.path);
      await loadNotes();
      toast.success("Note archived");
    } catch {
      toast.error("Failed to archive note");
    }
    setCtxMenu(null);
    setMoveSubmenu(null);
  }, [ctxMenu, loadNotes]);

  const handleRestore = useCallback(
    async (path: string) => {
      try {
        await client.archive.restore(path);
        await loadNotes();
        const updated = await client.archive.list().catch(() => [] as ArchivedNoteEntry[]);
        setArchivedNotes(updated);
        toast.success("Note restored");
      } catch {
        toast.error("Failed to restore note");
      }
    },
    [loadNotes],
  );

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
      case "archived":
        filtered = [];
        label = "Archived";
        break;
      case "status":
        filtered = allNotes.filter((n) => statusById.get(n.id) === filter.status);
        label = NOTE_STATUS_META[filter.status].label;
        break;
    }

    const sorted = [...filtered].sort((a, b) => {
      let cmp: number;
      switch (sortOrder) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "created":
          cmp = b.mtime - a.mtime;
          break;
        case "updated":
        default:
          cmp = b.mtime - a.mtime;
          break;
      }
      return sortAsc ? -cmp : cmp;
    });

    return { notes: sorted, scopeLabel: label };
  }, [filter, allNotes, tags, noteTagMap, pinnedIds, statusById, sortOrder, sortAsc]);

  // Virtualize the note list so 1k+ vaults render only the visible cards.
  // Card heights vary (snippet, tags, status), so estimate + measureElement.
  const scrollRef = useRef<HTMLUListElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 8,
    getItemKey: (index) => notes[index].id,
  });

  return (
    <section className="flex min-h-0 flex-col border-r border-[var(--color-cork-border)]">
      <div
        ref={dragRef}
        className={`flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-cork-border)] px-3 ${
          !sidebarOpen ? "pl-[76px]" : ""
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            className={`rounded-md p-1.5 ${
              sidebarOpen
                ? "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
                : "bg-[var(--color-cork-panel-2)] text-[var(--color-cork-ink)]"
            }`}
          >
            <SidebarSimple size={14} className="scale-x-[-1]" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void createNote()}
            title="New note (⌘N)"
            className="rounded-md p-1.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          >
            <Plus size={14} weight="bold" />
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            title="Search (⌘K)"
            className="rounded-md p-1.5 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
          >
            <MagnifyingGlass size={14} />
          </button>
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={() => setFilterMenuOpen((v) => !v)}
              title="Sort & filter"
              className={`rounded-md p-1.5 ${
                filterMenuOpen
                  ? "bg-[var(--color-cork-panel-2)] text-[var(--color-cork-ink)]"
                  : "text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              }`}
            >
              <FunnelSimple size={14} />
            </button>
            {filterMenuOpen && (
              <div
                ref={filterMenuRef}
                className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] py-1 shadow-lg"
              >
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cork-subtle)]">
                  Sort by
                </p>
                {(["updated", "created", "title"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (sortOrder === key) {
                        setSortAsc((v) => !v);
                      } else {
                        setSortOrder(key);
                        setSortAsc(false);
                      }
                      setFilterMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[var(--color-cork-panel-2)] ${
                      sortOrder === key
                        ? "text-[var(--color-cork-ink)] font-medium"
                        : "text-[var(--color-cork-muted)]"
                    }`}
                  >
                    <span className="capitalize">{key}</span>
                    {sortOrder === key &&
                      (sortAsc ? <SortAscending size={12} /> : <SortDescending size={12} />)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3 text-xs text-[var(--color-cork-muted)]">
        <span>
          {scopeLabel} · {filter.kind === "archived" ? archivedNotes.length : notes.length} notes
        </span>
      </div>

      <ul
        ref={scrollRef}
        className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {isLoading && (
          <li className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <CircleNotch size={24} className="animate-spin text-[var(--color-cork-accent)]" />
            <span className="text-[12px] text-[var(--color-cork-subtle)]">Opening vault…</span>
          </li>
        )}
        {!isLoading && isIndexing && indexProgress && notes.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <CircleNotch size={24} className="animate-spin text-[var(--color-cork-accent)]" />
            <span className="text-[12px] text-[var(--color-cork-subtle)]">
              Indexing notes… {indexProgress.processed}/{indexProgress.total}
            </span>
          </li>
        )}
        {!isLoading &&
          filter.kind === "archived" &&
          archivedNotes.map((n) => (
            <li key={n.path}>
              <div
                style={{
                  paddingTop: "var(--density-card-py)",
                  paddingBottom: "var(--density-card-py)",
                }}
                className="group flex w-full flex-col gap-1.5 border-l-[3px] border-transparent px-4 text-left transition hover:bg-[var(--color-cork-panel-2)]"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-[13px] font-semibold text-[var(--color-cork-ink)]">
                    {n.title}
                  </span>
                  <button
                    onClick={() => void handleRestore(n.path)}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--color-cork-accent)] opacity-0 transition-opacity hover:bg-[var(--color-cork-accent-soft)] group-hover:opacity-100"
                    title="Restore note"
                  >
                    <ArrowCounterClockwise size={12} />
                    Restore
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--color-cork-subtle)]">
                  <span>{n.archivedFrom ? `from ${n.archivedFrom}` : "from root"}</span>
                  <span>
                    {n.daysRemaining != null
                      ? n.daysRemaining > 0
                        ? `${n.daysRemaining}d remaining`
                        : "Expiring soon"
                      : "Kept forever"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        {!isLoading && filter.kind === "archived" && archivedNotes.length === 0 && (
          <li className="px-4 py-8 text-center text-[12px] text-[var(--color-cork-subtle)]">
            No archived notes
          </li>
        )}
        {!isLoading && filter.kind !== "archived" && notes.length > 0 && (
          <li className="relative block w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const n = notes[vi.index];
              const isActive = view.kind === "note" && view.id === n.id;
              const noteTags = noteTagMap.get(n.id) ?? [];
              const noteStatus = statusById.get(n.id);
              return (
                <div
                  key={n.id}
                  data-index={vi.index}
                  ref={rowVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <div
                    onClick={() => openNote(n.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openNote(n.id);
                    }}
                    style={{
                      paddingTop: "var(--density-card-py)",
                      paddingBottom: "var(--density-card-py)",
                    }}
                    className={`group flex w-full flex-col gap-1.5 border-l-[3px] px-4 text-left transition cursor-pointer ${
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
                      <span className="flex min-w-0 items-center gap-1.5">
                        {noteStatus && <StatusBadge status={noteStatus} />}
                        <span className="truncate">{formatRelativeDate(n.mtime)}</span>
                      </span>
                      <span className="shrink-0">Created {formatRelativeDate(n.ctime)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </li>
        )}
        {!isLoading && !isIndexing && filter.kind !== "archived" && notes.length === 0 && (
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
            onStatus={handleStatusTo}
            onMoveTo={() => void handleMoveTo()}
            onArchive={() => void handleArchive()}
          />,
          document.body,
        )}

      {statusSubmenu &&
        ctxMenu &&
        createPortal(
          <StatusSubmenu
            ref={statusSubmenuRef}
            x={statusSubmenu.x}
            y={statusSubmenu.y}
            current={statusById.get(ctxMenu.note.id)}
            onSelect={(status) => void handleStatusSelect(status)}
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
