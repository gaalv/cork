import { Info } from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";
import { useIndexStore } from "@/stores/indexStore";
import { NOTE_STATUSES, NOTE_STATUS_META, narrowNoteStatus } from "@/utils/noteStatus";
import { SectionHeader, formatDate, formatRelative, parseDate } from "./helpers";

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
        <select
          value={status ?? ""}
          onChange={(e) => {
            if (!noteId || !path) return;
            void setNoteStatus(noteId, path, narrowNoteStatus(e.target.value) ?? null);
          }}
          className="w-fit rounded-md border border-[var(--color-cork-border)] bg-[var(--color-cork-panel-2)] px-1.5 py-0.5 text-[12px] text-[var(--color-cork-ink)]"
        >
          <option value="">None</option>
          {NOTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {NOTE_STATUS_META[s].label}
            </option>
          ))}
        </select>
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
