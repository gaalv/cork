import type { OutlineItem } from "@/features/note-view/hooks/useOutline";

type OutlineProps = {
  items: OutlineItem[];
  activeId?: string | null;
  onSelect: (item: OutlineItem) => void;
};

export function Outline({ items, activeId, onSelect }: OutlineProps) {
  return (
    <section aria-labelledby="note-outline-heading" className="space-y-2">
      <h2 id="note-outline-heading" className="text-sm font-semibold">Outline</h2>
      {items.length === 0 ? <p className="text-sm text-[var(--color-noxe-muted)]">No headings</p> : null}
      <ol className="space-y-1">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.depth - 1) * 12}px` }}>
            <button
              type="button"
              aria-current={activeId === item.id ? "true" : undefined}
              onClick={() => onSelect(item)}
              className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-[var(--color-noxe-panel-2)] aria-current:bg-[var(--color-noxe-accent-soft)]"
            >
              {item.text}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
