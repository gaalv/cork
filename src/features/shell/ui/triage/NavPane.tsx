import { useMemo } from "react";
import { CaretRight, Folder, GearSix, Plus, Star, Tag, Tray, Clock } from "@phosphor-icons/react";

import { useFolderTree, type FolderTreeNode } from "@/features/drawers/hooks/useFolderTree";
import { useTagTree, type TagTreeNode } from "@/features/drawers/hooks/useTagTree";
import { createAndOpenNote } from "@/features/note-ops/services/createAndOpenNote";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { useTriageStore, type TriageSelection } from "@/features/shell/state/triageStore";
import { SyncIndicator } from "@/features/sync/ui/SyncIndicator";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { cn } from "@/shared/utils/cn";
const TAG_LIMIT = 20;

export function NavPane() {
  const selection = useTriageStore((state) => state.selection);
  const setSelection = useTriageStore((state) => state.setSelection);
  const folderTree = useFolderTree();
  const { tree: tagTree } = useTagTree();
  const flatTags = useMemo(() => flattenTags(tagTree).slice(0, TAG_LIMIT), [tagTree]);
  const openSettings = useSettingsUiStore((state) => state.openSettings);
  const vaultPath = useVaultStore((state) => state.path);
  const noteCount = useVaultStore((state) => state.notes.length);
  const footerPath = vaultPath ? formatVaultPath(vaultPath) : "";

  const isActive = (s: TriageSelection) => isSelectionEqual(selection, s);

  const handleNewNote = () => {
    const folder = selection.kind === "folder" ? selection.path : "";
    void createAndOpenNote({ folder });
  };

  return (
    <nav
      data-testid="triage-nav-pane"
      className="flex h-full flex-col overflow-hidden bg-[var(--color-noxe-panel)] text-sm"
      aria-label="Triage navigation"
    >
      <header className="flex h-12 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-noxe-ink)]">
            Noxe
          </span>
          <span className="rounded bg-[var(--color-noxe-panel-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-noxe-muted)]">
            vault
          </span>
        </div>
        <SyncIndicator />
      </header>

      <div className="px-3 pb-3">
        <button
          type="button"
          data-testid="triage-new-note"
          onClick={handleNewNote}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-noxe-accent)] px-2.5 py-1.5 text-sm font-medium text-white shadow-sm hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
        >
          <Plus size={14} weight="bold" />
          New note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
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

        <Section title="Folders">
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
                icon={<Tag size={14} />}
                label={tag.tag}
                count={tag.count}
                active={isActive({ kind: "tag", tag: tag.tag })}
                onClick={() => setSelection({ kind: "tag", tag: tag.tag })}
                testId={`nav-tag-${tag.tag}`}
              />
            ))
          )}
        </Section>
      </div>

      <footer
        data-testid="triage-nav-footer"
        className="flex items-center gap-2 border-t border-[var(--color-noxe-border)] px-3 py-1.5 text-[11px] text-[var(--color-noxe-muted)]"
      >
        <span
          data-testid="triage-nav-vault-path"
          className="min-w-0 flex-1 truncate"
          title={vaultPath ?? undefined}
        >
          {footerPath || "No vault"}
        </span>
        <span data-testid="triage-nav-note-count" className="shrink-0 tabular-nums">
          {noteCount} {noteCount === 1 ? "note" : "notes"}
        </span>
        <button
          type="button"
          aria-label="Settings"
          data-testid="triage-settings"
          onClick={() => openSettings()}
          className="rounded p-1 text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
          title="Settings"
        >
          <GearSix size={14} />
        </button>
      </footer>
    </nav>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-noxe-subtle)]">
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

function formatVaultPath(absolute: string): string {
  const normalised = absolute.replace(/\\/g, "/").replace(/\/$/, "");
  const segments = normalised.split("/").filter(Boolean);
  if (segments.length === 0) return normalised || "/";
  if (segments.length <= 2) return normalised;
  return "…/" + segments.slice(-2).join("/");
}
