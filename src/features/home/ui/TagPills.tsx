import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useShellStore } from "@/features/shell/state/shellStore";

import type { TagCount } from "@/shared/ipc/IpcContract";

type TagPillsProps = {
  tags: TagCount[];
};

export function TagPills({ tags }: TagPillsProps) {
  const selectedTag = useDrawersStore((state) => state.selectedTag);
  const selectTag = useDrawersStore((state) => state.selectTag);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);

  if (tags.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="home-tags-heading" className="space-y-3">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">By tag</p>
        <h2 id="home-tags-heading" className="text-lg font-semibold">
          Explore themes
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.tag}
            type="button"
            aria-pressed={selectedTag === tag.tag}
            onClick={() => {
              selectTag(tag.tag);
              toggleDrawer("tags");
            }}
            className="rounded-full border border-[var(--color-noxe-border)] px-3 py-1.5 text-sm hover:border-[var(--color-noxe-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none aria-pressed:bg-[var(--color-noxe-accent-soft)]"
          >
            #{tag.tag} <span className="text-[var(--color-noxe-muted)]">{tag.count}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
