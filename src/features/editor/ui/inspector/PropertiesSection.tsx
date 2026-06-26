import { Info } from "@phosphor-icons/react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { SectionHeader, formatDate, formatRelative, parseDate } from "./helpers";

export function PropertiesSection({ noteMtime }: { noteMtime: number }) {
  const body = useEditorStore((s) => s.body);
  const frontmatter = useEditorStore((s) => s.frontmatter);

  const wordCount = body ? body.split(/\s+/).filter(Boolean).length : 0;
  const charCount = body ? body.length : 0;

  const created = frontmatter.created
    ? formatDate(Number(frontmatter.created) || parseDate(String(frontmatter.created)))
    : formatDate(noteMtime);

  const updated = formatRelative(noteMtime);

  return (
    <section>
      <SectionHeader icon={<Info size={14} />} title="Properties" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
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
