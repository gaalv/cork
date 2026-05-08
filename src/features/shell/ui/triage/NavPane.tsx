import { useMemo } from "react";
import { CaretRight, Folder, Hash, Star, Tray, Clock } from "@phosphor-icons/react";

import { useFolderTree, type FolderTreeNode } from "@/features/drawers/hooks/useFolderTree";
import { useTagTree, type TagTreeNode } from "@/features/drawers/hooks/useTagTree";
import { useTriageStore, type TriageSelection } from "@/features/shell/state/triageStore";
import { cn } from "@/shared/utils/cn";

const TAG_LIMIT = 20;

export function NavPane() {
  const selection = useTriageStore((state) => state.selection);
  const setSelection = useTriageStore((state) => state.setSelection);
  const folderTree = useFolderTree();
  const { tree: tagTree } = useTagTree();
  const flatTags = useMemo(() => flattenTags(tagTree).slice(0, TAG_LIMIT), [tagTree]);

  const isActive = (s: TriageSelection) => isSelectionEqual(selection, s);

  return (
    <nav
      data-testid="triage-nav-pane"
      className="flex h-full flex-col gap-4 overflow-y-auto border-r border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-4 text-sm"
      aria-label="Triage navigation"
    >
      <Section title="Shortcuts">
        <Row
          icon={<Star size={14} weight="fill" />}
          label="Pinned"
          active={isActive({ kind: "shortcut", id: "pinned" })}
          onClick={() => setSelection({ kind: "shortcut", id: "pinned" })}
          testId="nav-shortcut-pinned"
        />
        <Row
          icon={<Clock size={14} />}
          label="Recent"
          active={isActive({ kind: "shortcut", id: "recent" })}
          onClick={() => setSelection({ kind: "shortcut", id: "recent" })}
          testId="nav-shortcut-recent"
        />
        <Row
          icon={<Tray size={14} />}
          label="Inbox"
          active={isActive({ kind: "shortcut", id: "inbox" })}
          onClick={() => setSelection({ kind: "shortcut", id: "inbox" })}
          testId="nav-shortcut-inbox"
        />
      </Section>

      <Section title="Notebooks">
        {folderTree.length === 0 ? (
          <p className="px-2 py-1 text-xs text-[var(--color-noxe-muted)]">No folders yet.</p>
        ) : (
          folderTree.map((node) => (
            <FolderRow
              key={node.path}
              node={node}
              depth={0}
              selectionPath={selection.kind === "folder" ? selection.path : null}
              onSelect={(path) => setSelection({ kind: "folder", path })}
            />
          ))
        )}
      </Section>

      <Section title="Tags">
        {flatTags.length === 0 ? (
          <p className="px-2 py-1 text-xs text-[var(--color-noxe-muted)]">No tags yet.</p>
        ) : (
          flatTags.map((tag) => (
            <Row
              key={tag.tag}
              icon={<Hash size={14} />}
              label={tag.tag}
              count={tag.count}
              active={isActive({ kind: "tag", tag: tag.tag })}
              onClick={() => setSelection({ kind: "tag", tag: tag.tag })}
              testId={`nav-tag-${tag.tag}`}
            />
          ))
        )}
      </Section>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-muted)]">
        {title}
      </p>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

type RowProps = {
  icon?: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  testId?: string;
};

function Row({ icon, label, count, active, onClick, testId }: RowProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors",
        active
          ? "bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-ink)]"
          : "text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]",
      )}
    >
      {icon ? <span className="text-[var(--color-noxe-muted)]">{icon}</span> : null}
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" ? (
        <span className="text-[11px] text-[var(--color-noxe-muted)]">{count}</span>
      ) : null}
    </button>
  );
}

function FolderRow({
  node,
  depth,
  selectionPath,
  onSelect,
}: {
  node: FolderTreeNode;
  depth: number;
  selectionPath: string | null;
  onSelect: (path: string) => void;
}) {
  const active = selectionPath === node.path;
  return (
    <div>
      <button
        type="button"
        data-testid={`nav-folder-${node.path}`}
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors",
          active
            ? "bg-[var(--color-noxe-accent-soft)] text-[var(--color-noxe-ink)]"
            : "text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]",
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {node.children.length > 0 ? (
          <CaretRight size={12} className="text-[var(--color-noxe-muted)]" />
        ) : (
          <span style={{ width: 12 }} />
        )}
        <Folder size={14} className="text-[var(--color-noxe-muted)]" />
        <span className="flex-1 truncate">{node.name}</span>
        <span className="text-[11px] text-[var(--color-noxe-muted)]">{node.count}</span>
      </button>
      {node.children.map((child) => (
        <FolderRow
          key={child.path}
          node={child}
          depth={depth + 1}
          selectionPath={selectionPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function flattenTags(nodes: TagTreeNode[]): TagTreeNode[] {
  const out: TagTreeNode[] = [];
  const visit = (list: TagTreeNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children.length > 0) visit(node.children);
    }
  };
  visit(nodes);
  out.sort((a, b) => b.count - a.count);
  return out;
}

function isSelectionEqual(a: TriageSelection, b: TriageSelection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "shortcut" && b.kind === "shortcut") return a.id === b.id;
  if (a.kind === "folder" && b.kind === "folder") return a.path === b.path;
  if (a.kind === "tag" && b.kind === "tag") return a.tag === b.tag;
  return false;
}
