import { useState } from "react";
import { CaretRight, Folder, FolderOpen } from "@phosphor-icons/react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { folderOps, validateFolderName } from "@/features/folder-ops/services/folderOps";
import { InlineRename } from "@/features/folder-ops/ui/InlineRename";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { resolveNoteIcon } from "@/shared/ui/noteIcons";
import { cn } from "@/shared/utils/cn";

import { FolderRowMenu } from "./FolderRowMenu";

import type { FolderTreeNode } from "@/features/drawers/hooks/useFolderTree";

type FolderNodeProps = {
  node: FolderTreeNode;
  depth?: number;
  onOpenNote?: (id: string) => void;
};

export function FolderNode({ node, depth = 0, onOpenNote }: FolderNodeProps) {
  const expanded = useDrawersStore((state) => state.expandedFolders.has(node.path));
  const selected = useDrawersStore((state) => state.selectedFolder === node.path);
  const toggleFolder = useDrawersStore((state) => state.toggleFolder);
  const setFolderExpanded = useDrawersStore((state) => state.setFolderExpanded);
  const selectFolder = useDrawersStore((state) => state.selectFolder);
  const loadNotes = useVaultStore((state) => state.loadNotes);
  const [renaming, setRenaming] = useState(false);
  const hasChildren = node.children.length > 0;
  const hasNotes = node.notes.length > 0;
  const isOpen = expanded && (hasChildren || hasNotes);

  const commitRename = async (next: string) => {
    try {
      await folderOps.rename({ oldPath: node.path, newName: next });
      await loadNotes();
    } finally {
      setRenaming(false);
    }
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren || hasNotes ? expanded : undefined} aria-level={depth + 1} aria-selected={selected}>
      <div
        className={cn(
          "group relative flex w-full items-center gap-1 rounded-md py-1 pr-1 text-left text-sm hover:bg-[var(--color-noxe-panel-2)]",
          selected && "bg-[var(--color-noxe-panel-2)] ring-1 ring-[var(--color-noxe-ring)]",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onClick={(event) => {
            event.stopPropagation();
            setFolderExpanded(node.path, !expanded);
          }}
          className="grid h-5 w-4 shrink-0 place-items-center text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)]"
        >
          <CaretRight size={12} weight="bold" className={cn("transition-transform", expanded && "rotate-90")} />
        </button>
        {isOpen ? (
          <FolderOpen size={14} weight="duotone" className="shrink-0 text-[var(--color-noxe-muted)]" />
        ) : (
          <Folder size={14} weight="duotone" className="shrink-0 text-[var(--color-noxe-muted)]" />
        )}
        {renaming ? (
          <InlineRename
            initial={node.name}
            label={`Rename ${node.name}`}
            validate={validateFolderName}
            onCommit={commitRename}
            onCancel={() => setRenaming(false)}
            className="min-w-0 flex-1 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              selectFolder(node.path);
              toggleFolder(node.path);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" && (hasChildren || hasNotes) && !expanded) {
                event.preventDefault();
                setFolderExpanded(node.path, true);
              }
              if (event.key === "ArrowLeft" && expanded) {
                event.preventDefault();
                setFolderExpanded(node.path, false);
              }
              if (event.key === "F2") {
                event.preventDefault();
                setRenaming(true);
              }
            }}
            className="min-w-0 flex-1 truncate text-left focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
          >
            {node.name}
          </button>
        )}
        <span className="shrink-0 text-[11px] text-[var(--color-noxe-muted)]">{node.count}</span>
        {!renaming ? (
          <FolderRowMenu path={node.path} name={node.name} onRequestRename={() => setRenaming(true)} />
        ) : null}
      </div>
      {expanded ? (
        <ul role="group" className="space-y-0.5">
          {node.children.map((child) => (
            <FolderNode key={child.path} node={child} depth={depth + 1} onOpenNote={onOpenNote} />
          ))}
          {hasNotes ? (
            node.notes.map((note) => {
              const NoteIcon = resolveNoteIcon(undefined);
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
                    style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}
                    onClick={() => onOpenNote?.(note.id)}
                  >
                    <NoteIcon size={12} weight="duotone" className="shrink-0" />
                    <span className="truncate">{note.title}</span>
                  </button>
                </li>
              );
            })
          ) : !hasChildren ? (
            <li className="py-1 pr-2 text-xs text-[var(--color-noxe-muted)]" style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}>
              (no notes)
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}
