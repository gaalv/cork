import { CaretRight, FileText } from "@phosphor-icons/react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { cn } from "@/shared/utils/cn";

import type { FolderTreeNode } from "@/features/drawers/hooks/useFolderTree";

type FolderNodeProps = {
  node: FolderTreeNode;
  depth?: number;
  onOpenNote?: (id: string) => void;
};

export function FolderNode({ node, depth = 0, onOpenNote }: FolderNodeProps) {
  const expanded = useDrawersStore((state) => state.expandedFolders.has(node.path));
  const toggleFolder = useDrawersStore((state) => state.toggleFolder);
  const setFolderExpanded = useDrawersStore((state) => state.setFolderExpanded);
  const hasChildren = node.children.length > 0;
  const hasNotes = node.notes.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren || hasNotes ? expanded : undefined} aria-level={depth + 1}>
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => toggleFolder(node.path)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && (hasChildren || hasNotes) && !expanded) {
            event.preventDefault();
            setFolderExpanded(node.path, true);
          }
          if (event.key === "ArrowLeft" && expanded) {
            event.preventDefault();
            setFolderExpanded(node.path, false);
          }
        }}
      >
        <CaretRight size={13} className={cn("shrink-0 transition-transform", expanded && "rotate-90")} />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="text-[11px] text-[var(--color-noxe-muted)]">{node.count}</span>
      </button>
      {expanded ? (
        <ul role="group" className="space-y-0.5">
          {node.children.map((child) => (
            <FolderNode key={child.path} node={child} depth={depth + 1} onOpenNote={onOpenNote} />
          ))}
          {hasNotes ? (
            node.notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
                  style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}
                  onClick={() => onOpenNote?.(note.id)}
                >
                  <FileText size={12} />
                  <span className="truncate">{note.title}</span>
                </button>
              </li>
            ))
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
