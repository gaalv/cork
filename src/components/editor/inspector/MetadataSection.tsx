/**
 * Properties / metadata section — word count, char count, dates.
 */

import { Info } from "@phosphor-icons/react";

import { useEditorStore } from "@/stores/editorStore";
import { SectionHeader } from "./SectionHeader";
import { formatRelative } from "./helpers";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(ts: number): string {
  if (!ts || Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseDate(str: string): number {
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MetadataSection({ noteMtime }: { noteMtime: number }) {
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
      <SectionHeader icon={<Info size={14} />} title="Propriedades" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
        <span className="text-[var(--color-cork-muted)]">Criado</span>
        <span className="text-[var(--color-cork-ink)]">{created}</span>
        <span className="text-[var(--color-cork-muted)]">Atualizado</span>
        <span className="text-[var(--color-cork-ink)]">{updated}</span>
        <span className="text-[var(--color-cork-muted)]">Palavras</span>
        <span className="text-[var(--color-cork-ink)]">{wordCount}</span>
        <span className="text-[var(--color-cork-muted)]">Caracteres</span>
        <span className="text-[var(--color-cork-ink)]">{charCount}</span>
      </div>
    </section>
  );
}
