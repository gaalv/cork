import { Info } from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";
import { useIndexStore } from "@/stores/indexStore";
import { Select, type SelectOption } from "@/components/ui/Select";
import { cn } from "@/utils/cn";
import { NOTE_STATUSES, NOTE_STATUS_META, narrowNoteStatus } from "@/utils/noteStatus";
import { SectionHeader, formatDate, formatRelative, parseDate } from "./helpers";

/** Same dot the sidebar and the note badge use, so status reads alike anywhere. */
function StatusDot({ className }: { className: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)} />;
}

const STATUS_OPTIONS: SelectOption<string>[] = [
  // An invisible dot keeps "None" aligned with the statuses below it.
  { value: "", label: "None", icon: <StatusDot className="bg-transparent" /> },
  ...NOTE_STATUSES.map((s) => ({
    value: s as string,
    label: NOTE_STATUS_META[s].label,
    icon: <StatusDot className={NOTE_STATUS_META[s].dotClass} />,
  })),
];

export function PropertiesSection({ noteMtime }: { noteMtime: number }) {
  const body = useEditorStore((s) => s.body);
  const frontmatter = useEditorStore((s) => s.frontmatter);
  const noteId = useEditorStore((s) => s.noteId);
  const path = useEditorStore((s) => s.path);
  const statusById = useIndexStore((s) => s.statusById);
  const setNoteStatus = useIndexStore((s) => s.setNoteStatus);

  const wordCount = body ? body.split(/\s+/).filter(Boolean).length : 0;
  const charCount = body ? body.length : 0;

  const created = frontmatter.created
    ? formatDate(Number(frontmatter.created) || parseDate(String(frontmatter.created)))
    : formatDate(noteMtime);

  const updated = formatRelative(noteMtime);

  const status = noteId ? statusById.get(noteId) : undefined;

  return (
    <section>
      <SectionHeader icon={<Info size={14} />} title="Properties" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        <span className="text-[var(--color-cork-muted)]">Status</span>
        <Select
          variant="minimal"
          ariaLabel="Note status"
          value={status ?? ""}
          options={STATUS_OPTIONS}
          onChange={(next) => {
            if (!noteId || !path) return;
            void setNoteStatus(noteId, path, narrowNoteStatus(next) ?? null);
          }}
        />
        <span className="text-[var(--color-cork-muted)]">Created</span>
        <span className="text-[var(--color-cork-ink)]">{created}</span>
        <span className="text-[var(--color-cork-muted)]">Updated</span>
        <span className="text-[var(--color-cork-ink)]">{updated}</span>
        <span className="text-[var(--color-cork-muted)]">Words</span>
        <span className="text-[var(--color-cork-ink)]">{wordCount}</span>
        <span className="text-[var(--color-cork-muted)]">Chars</span>
        <span className="text-[var(--color-cork-ink)]">{charCount}</span>
      </div>
    </section>
  );
}
