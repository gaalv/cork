import type { Backlink } from "@/features/note-view/hooks/useBacklinks";
import type { NoteEntry } from "@/shared/ipc/types";

type BacklinksListProps = {
  backlinks: Backlink[];
  onOpen: (note: NoteEntry) => void;
};

export function BacklinksList({ backlinks, onOpen }: BacklinksListProps) {
  const visible = backlinks.slice(0, 30);
  return (
    <section aria-labelledby="note-backlinks-heading" className="space-y-2">
      <h2 id="note-backlinks-heading" className="text-sm font-semibold">Backlinks</h2>
      {backlinks.length === 0 ? <p className="text-sm text-[var(--color-noxe-muted)]">No backlinks yet.</p> : null}
      <ul className="space-y-1">
        {visible.map((backlink) => (
          <li key={`${backlink.srcNoteId}-${backlink.position}`}>
            <button
              type="button"
              disabled={!backlink.source}
              onClick={() => backlink.source && onOpen(backlink.source)}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--color-noxe-panel-2)] disabled:opacity-60"
            >
              {backlink.source?.title ?? backlink.srcNoteId}
              {backlink.alias ? <span className="text-[var(--color-noxe-muted)]"> · {backlink.alias}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {backlinks.length > visible.length ? <p className="text-xs text-[var(--color-noxe-muted)]">Showing first 30 backlinks.</p> : null}
    </section>
  );
}
