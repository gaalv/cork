import { CaretRight, Hash } from "@phosphor-icons/react";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { cn } from "@/shared/utils/cn";

import type { TagTreeNode } from "@/features/drawers/hooks/useTagTree";

type TagNodeProps = {
  node: TagTreeNode;
  depth?: number;
  onSelectTag: (tag: string) => void;
};

export function TagNode({ node, depth = 0, onSelectTag }: TagNodeProps) {
  const expanded = useDrawersStore((state) => state.expandedTags.has(node.tag));
  const toggleTag = useDrawersStore((state) => state.toggleTag);
  const setTagExpanded = useDrawersStore((state) => state.setTagExpanded);
  const selectedTag = useDrawersStore((state) => state.selectedTag);
  const hasChildren = node.children.length > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedTag === node.tag} aria-level={depth + 1}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left text-sm hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none",
          selectedTag === node.tag && "bg-[var(--color-noxe-panel-2)]",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (hasChildren) {
            toggleTag(node.tag);
          } else {
            onSelectTag(node.tag);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && hasChildren && !expanded) {
            event.preventDefault();
            setTagExpanded(node.tag, true);
          }
          if (event.key === "ArrowLeft" && expanded) {
            event.preventDefault();
            setTagExpanded(node.tag, false);
          }
        }}
      >
        {hasChildren ? <CaretRight size={13} className={cn("shrink-0 transition-transform", expanded && "rotate-90")} /> : <Hash size={13} />}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="text-[11px] text-[var(--color-noxe-muted)]">{node.count}</span>
      </button>
      {hasChildren && expanded ? (
        <ul role="group" className="space-y-0.5">
          {node.children.map((child) => (
            <TagNode key={child.tag} node={child} depth={depth + 1} onSelectTag={onSelectTag} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
