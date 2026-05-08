import { LinkSimple } from "@phosphor-icons/react";

import type { Backlink } from "@/features/note-view/hooks/useBacklinks";
import type { NoteEntry } from "@/shared/ipc/types";

import { SectionHeader } from "./SectionHeader";

type BacklinksListProps = {
  backlinks: Backlink[];
  onOpen: (note: NoteEntry) => void;
};

export function BacklinksList({ backlinks, onOpen }: BacklinksListProps) {
  const visible = backlinks.slice(0, 30);
  return (
    <section aria-labelledby="note-backlinks-heading" className="space-y-1.5">
      <SectionHeader
        id="note-backlinks-heading"
        icon={<LinkSimple size={14} />}
        label="Backlinks"
      />
      {backlinks.length === 0 ? (
        <p className="px-1 text-xs text-[var(--color-noxe-muted)]">No backlinks yet.</p>
      ) : null}
      <ul className="space-y-px">
        {visible.map((backlink) => (
          <li key={`${backlink.srcNoteId}-${backlink.position}`}>
            <button
              type="button"
              disabled={!backlink.source}
              onClick={() => backlink.source && onOpen(backlink.source)}
              className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] disabled:opacity-60"
            >
              {backlink.source?.title ?? backlink.srcNoteId}
              {backlink.alias ? (
                <span className="text-[var(--color-noxe-muted)]"> · {backlink.alias}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {backlinks.length > visible.length ? (
        <p className="px-1 text-[10px] text-[var(--color-noxe-muted)]">
          Showing first 30 backlinks.
        </p>
      ) : null}
    </section>
  );
}
