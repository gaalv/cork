import type { OutlineItem } from "@/features/note-view/hooks/useOutline";
import { ListBullets } from "@phosphor-icons/react";

import { SectionHeader } from "./SectionHeader";

type OutlineProps = {
  items: OutlineItem[];
  activeId?: string | null;
  onSelect: (item: OutlineItem) => void;
};

export function Outline({ items, activeId, onSelect }: OutlineProps) {
  const handleSelect = (item: OutlineItem) => {
    onSelect(item);
    const target =
      document.getElementById(item.id) ??
      document.querySelector(`[data-outline-id="${CSS.escape(item.id)}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };
  return (
    <section aria-labelledby="note-outline-heading" className="space-y-1.5">
      <SectionHeader id="note-outline-heading" icon={<ListBullets size={14} />} label="Outline" />
      {items.length === 0 ? (
        <p className="px-2 text-xs text-[var(--color-noxe-muted)]">No headings yet</p>
      ) : null}
      <ol className="space-y-px">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.depth - 1) * 10}px` }}>
            <button
              type="button"
              aria-current={activeId === item.id ? "true" : undefined}
              onClick={() => handleSelect(item)}
              className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] aria-current:bg-[var(--color-noxe-accent-soft)] aria-current:text-[var(--color-noxe-accent)]"
            >
              {item.text}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
