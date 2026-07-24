import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDragRegion } from "@/hooks/useDragRegion";
import { toast } from "sonner";
import { Archive, FolderSimple, NotePencil, Plus, Star, Tag, Tray } from "@phosphor-icons/react";
import { createPortal } from "react-dom";

import { getIconComponent } from "@/components/ui/IconPicker";
import { useVaultStore } from "@/stores/vaultStore";
import { useIndexStore } from "@/stores/indexStore";
import { folderOps } from "@/services/folderOps";
import { client } from "@/ipc/client";

import { cn } from "@/utils/cn";
import { NOTE_STATUSES, NOTE_STATUS_META } from "@/utils/noteStatus";
import type { SidebarFilter } from "@/utils/triageHelpers";
import type { NoteStatus } from "@/ipc/types";
import {
  loadFolderIcons,
  saveFolderIcon,
  loadFolderColors,
  saveFolderColor,
  loadFolderPrefsFromVault,
  FOLDER_COLOR_MAP,
  clampMenuPosition,
} from "@/utils/triageHelpers";
import { SidebarSection, SidebarRow, InlineNewFolder, InlineNewTag } from "./SidebarPrimitives";
import { FolderContextPopover } from "./FolderContextPopover";
import { TagContextMenu } from "@/components/notes/TagContextMenu";

export function Sidebar({
  filter,
  setFilter,
}: {
  filter: SidebarFilter;
  setFilter: (f: SidebarFilter) => void;
}) {
  const notes = useVaultStore((s) => s.notes);
  const loadNotes = useVaultStore((s) => s.loadNotes);
  const tags = useIndexStore((s) => s.tags);
  const pinnedIds = useIndexStore((s) => s.pinnedIds);
  const statusById = useIndexStore((s) => s.statusById);
  const createTag = useIndexStore((s) => s.createTag);
  const renameTag = useIndexStore((s) => s.renameTag);
  const deleteTag = useIndexStore((s) => s.deleteTag);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [folderIcons, setFolderIcons] = useState(loadFolderIcons);
  const [folderColors, setFolderColors] = useState(loadFolderColors);
  const [folderCtx, setFolderCtx] = useState<{ id: string; x: number; y: number } | null>(null);
  const [tagCtx, setTagCtx] = useState<{ tag: string; x: number; y: number } | null>(null);
  const [diskFolders, setDiskFolders] = useState<string[]>([]);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);

  const refreshFolders = useCallback(() => {
    void client.folders
      .list()
      .then((res) => {
        setDiskFolders(res);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshFolders();
  }, [refreshFolders, notes]);

  useEffect(() => {
    void loadFolderPrefsFromVault().then(({ icons, colors }) => {
      setFolderIcons(icons);
      setFolderColors(colors);
    });
  }, []);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        await folderOps.create({ parent: "", name });
        refreshFolders();
        await loadNotes();
        setCreatingFolder(false);
        toast.success(`Folder "${name}" created`);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [loadNotes, refreshFolders],
  );

  const handleCreateTag = useCallback(
    async (tag: string) => {
      try {
        await createTag(tag);
        setCreatingTag(false);
        toast.success(`Tag "${tag}" created`);
      } catch (err) {
        toast.error(String(err));
      }
    },
    [createTag],
  );

  const folderTree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      if (note.folder) {
        counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1);
      }
    }
    for (const df of diskFolders) {
      if (!counts.has(df)) {
        counts.set(df, 0);
      }
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({
        id: name,
        name,
        count,
        depth: name.split("/").length - 1,
        parentId: name.includes("/") ? name.split("/").slice(0, -1).join("/") : null,
      }));
  }, [notes, diskFolders]);

  const inboxCount = useMemo(
    () => notes.filter((n) => !n.folder || n.folder.toLowerCase() === "inbox").length,
    [notes],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<NoteStatus, number> = { active: 0, "on-hold": 0, done: 0 };
    for (const status of statusById.values()) {
      counts[status] += 1;
    }
    return counts;
  }, [statusById]);
  const hasStatuses = NOTE_STATUSES.some((s) => statusCounts[s] > 0);

  useEffect(() => {
    if (!folderCtx && !tagCtx) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (folderCtx && folderMenuRef.current?.contains(target)) return;
      if (tagCtx && tagMenuRef.current?.contains(target)) return;
      setFolderCtx(null);
      setTagCtx(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFolderCtx(null);
        setTagCtx(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [folderCtx, tagCtx]);

  const dragRef = useDragRegion<HTMLDivElement>();
  const isFolderActive = (id: string) => filter.kind === "folder" && filter.id === id;

  return (
    <aside className="flex min-h-0 flex-col border-r border-[var(--color-cork-border)] bg-[var(--color-cork-panel)]">
      <div ref={dragRef} className="h-12 shrink-0" />

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col">
          <SidebarRow
            icon={<NotePencil size={14} />}
            label="All Notes"
            badge={String(notes.length)}
            active={filter.kind === "all"}
            onClick={() => setFilter({ kind: "all" })}
          />
          <SidebarRow
            icon={<Star size={14} />}
            label="Pinned"
            badge={pinnedIds.size > 0 ? String(pinnedIds.size) : undefined}
            active={filter.kind === "starred"}
            onClick={() => setFilter({ kind: "starred" })}
          />
          <SidebarRow
            icon={<Tray size={14} />}
            label="Inbox"
            badge={inboxCount > 0 ? String(inboxCount) : undefined}
            active={filter.kind === "inbox"}
            onClick={() => setFilter({ kind: "inbox" })}
          />
          <SidebarRow
            icon={<Archive size={14} />}
            label="Archived"
            active={filter.kind === "archived"}
            onClick={() => setFilter({ kind: "archived" })}
          />
        </div>

        {hasStatuses && (
          <SidebarSection title="Status">
            {NOTE_STATUSES.map((s) => (
              <SidebarRow
                key={s}
                icon={
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      NOTE_STATUS_META[s].dotClass,
                    )}
                  />
                }
                label={NOTE_STATUS_META[s].label}
                badge={statusCounts[s] > 0 ? String(statusCounts[s]) : undefined}
                active={filter.kind === "status" && filter.status === s}
                onClick={() => setFilter({ kind: "status", status: s })}
              />
            ))}
          </SidebarSection>
        )}

        <SidebarSection
          title="Notebooks"
          action={
            <button
              onClick={() => setCreatingFolder(true)}
              className="rounded p-0.5 text-[var(--color-cork-subtle)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              title="New folder"
            >
              <Plus size={10} weight="bold" />
            </button>
          }
        >
          {folderTree.map((f) => {
            const isActive = isFolderActive(f.id);
            const CustomIcon = folderIcons[f.id] ? getIconComponent(folderIcons[f.id]) : null;
            const FolderIcon = CustomIcon ?? FolderSimple;
            const folderColor = folderColors[f.id]
              ? FOLDER_COLOR_MAP[folderColors[f.id]]
              : undefined;
            return (
              <button
                key={f.id}
                onClick={() => setFilter({ kind: "folder", id: f.id })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTagCtx(null);
                  setFolderCtx({ id: f.id, x: e.clientX, y: e.clientY });
                }}
                className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left ${
                  isActive
                    ? "bg-[var(--color-cork-accent-soft)] text-[var(--color-cork-accent)]"
                    : "text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
                }`}
              >
                <FolderIcon
                  size={14}
                  style={!isActive && folderColor ? { color: folderColor } : undefined}
                  className={
                    isActive
                      ? "text-[var(--color-cork-accent)]"
                      : folderColor
                        ? ""
                        : "text-[var(--color-cork-muted)]"
                  }
                />
                <span className="truncate">{f.name}</span>
                <span className="ml-auto rounded-full bg-[var(--color-cork-accent-soft)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--color-cork-accent)]">
                  {f.count}
                </span>
              </button>
            );
          })}
          {creatingFolder && (
            <InlineNewFolder
              onConfirm={handleCreateFolder}
              onCancel={() => setCreatingFolder(false)}
            />
          )}
        </SidebarSection>

        <SidebarSection
          title="Tags"
          action={
            <button
              onClick={() => setCreatingTag(true)}
              className="rounded p-0.5 text-[var(--color-cork-subtle)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              title="New tag"
            >
              <Plus size={10} weight="bold" />
            </button>
          }
        >
          {tags.map((t) => {
            const isActive = filter.kind === "tag" && filter.tag === t.tag;
            return (
              <button
                key={t.tag}
                onClick={() => setFilter({ kind: "tag", tag: t.tag })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setFolderCtx(null);
                  setTagCtx({ tag: t.tag, x: e.clientX, y: e.clientY });
                }}
                className={`flex w-full items-center gap-2 rounded-[10px] px-2 py-1.5 text-left ${
                  isActive
                    ? "bg-[var(--color-cork-accent-soft)] text-[var(--color-cork-accent)]"
                    : "text-[var(--color-cork-ink)] hover:bg-[var(--color-cork-panel-2)]"
                }`}
              >
                <Tag size={14} className="text-[var(--color-cork-accent)]" />
                <span className="truncate">{t.tag}</span>
                <span className="ml-auto rounded-full bg-[var(--color-cork-accent-soft)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--color-cork-accent)]">
                  {t.count}
                </span>
              </button>
            );
          })}
          {tags.length === 0 && !creatingTag && (
            <p className="px-2 py-1 text-[11px] text-[var(--color-cork-subtle)]">No tags yet</p>
          )}
          {creatingTag && (
            <InlineNewTag onConfirm={handleCreateTag} onCancel={() => setCreatingTag(false)} />
          )}
        </SidebarSection>
      </nav>

      {folderCtx &&
        createPortal(
          <div
            ref={folderMenuRef}
            style={clampMenuPosition(folderCtx.x, folderCtx.y, 176, 140)}
            className="fixed z-50"
          >
            <FolderContextPopover
              folderId={folderCtx.id}
              iconName={folderIcons[folderCtx.id] ?? null}
              colorKey={folderColors[folderCtx.id] ?? null}
              onChangeIcon={(iconName) => {
                saveFolderIcon(folderCtx.id, iconName);
                setFolderIcons(loadFolderIcons());
              }}
              onChangeColor={(colorKey) => {
                saveFolderColor(folderCtx.id, colorKey);
                setFolderColors(loadFolderColors());
              }}
              onRename={async (newName) => {
                try {
                  await folderOps.rename({ oldPath: folderCtx.id, newName });
                  const parts = folderCtx.id.split("/");
                  parts[parts.length - 1] = newName;
                  const newFolderId = parts.join("/");
                  const oldIcon = folderIcons[folderCtx.id];
                  if (oldIcon) {
                    saveFolderIcon(folderCtx.id, null);
                    saveFolderIcon(newFolderId, oldIcon);
                    setFolderIcons(loadFolderIcons());
                  }
                  const oldColor = folderColors[folderCtx.id];
                  if (oldColor) {
                    saveFolderColor(folderCtx.id, null);
                    saveFolderColor(newFolderId, oldColor);
                    setFolderColors(loadFolderColors());
                  }
                  refreshFolders();
                  await loadNotes();
                  toast.success(`Renamed to "${newName}"`);
                } catch (err) {
                  toast.error(String(err));
                }
                setFolderCtx(null);
              }}
              onDelete={async () => {
                try {
                  await folderOps.trash(folderCtx.id);
                  refreshFolders();
                  await loadNotes();
                  toast.success(`Folder "${folderCtx.id}" deleted`);
                } catch (err) {
                  toast.error(String(err));
                }
                setFolderCtx(null);
              }}
              onClose={() => setFolderCtx(null)}
            />
          </div>,
          document.body,
        )}

      {tagCtx &&
        createPortal(
          <TagContextMenu
            ref={tagMenuRef}
            tag={tagCtx.tag}
            x={tagCtx.x}
            y={tagCtx.y}
            onRename={async (newName: string) => {
              try {
                await renameTag(tagCtx.tag, newName);
                toast.success(`Tag renamed to "${newName}"`);
              } catch (err) {
                toast.error(String(err));
              }
              setTagCtx(null);
            }}
            onDelete={async () => {
              try {
                await deleteTag(tagCtx.tag);
                toast.success(`Tag deleted`);
              } catch (err) {
                toast.error(String(err));
              }
              setTagCtx(null);
            }}
          />,
          document.body,
        )}
    </aside>
  );
}
