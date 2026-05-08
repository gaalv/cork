import { useMemo } from "react";
import { Info } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { NoteFolderField } from "./NoteFolderField";
import { SectionHeader } from "./SectionHeader";
import { TagsField } from "./TagsField";

type NotePropertiesProps = {
  noteId: string | null;
  body: string;
};

function formatRelative(value: number | undefined): string {
  if (!value) return "—";
  const diffMs = Date.now() - value;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatCreated(value: unknown, fallback: number | undefined): string {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
    }
    return value;
  }
  if (fallback) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(fallback));
  }
  return "—";
}

function formatBytes(value: number | undefined): string {
  if (value === undefined || value === null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} kB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

export function NoteProperties({ noteId, body }: NotePropertiesProps) {
  const note = useVaultStore((state) =>
    noteId ? (state.notes.find((entry) => entry.id === noteId) ?? null) : null,
  );
  const buffer = useEditorStore((state) => (noteId ? (state.buffers.get(noteId) ?? null) : null));

  const updated = useMemo(
    () => formatRelative(buffer?.loadedMtime ?? note?.mtime),
    [buffer?.loadedMtime, note?.mtime],
  );
  const created = useMemo(
    () => formatCreated(buffer?.frontmatter.created, note?.mtime),
    [buffer?.frontmatter.created, note?.mtime],
  );
  const words = useMemo(() => wordCount(body).toLocaleString(), [body]);
  const size = useMemo(() => formatBytes(note?.size), [note?.size]);

  return (
    <section aria-labelledby="note-properties-heading" className="space-y-2">
      <SectionHeader id="note-properties-heading" icon={<Info size={14} />} label="Properties" />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-1 text-[12px]">
        <PropRow label="Created" value={created} />
        <PropRow label="Updated" value={updated} />
        <PropRow label="Words" value={words} />
        <PropRow label="Size" value={size} />
      </dl>
      <div className="space-y-1.5 px-1">
        <NoteFolderField noteId={noteId} />
        <TagsField noteId={noteId} />
      </div>
    </section>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wider text-[var(--color-noxe-subtle)]">
        {label}
      </dt>
      <dd className="truncate text-[12px] text-[var(--color-noxe-ink)]" title={value}>
        {value}
      </dd>
    </div>
  );
}
