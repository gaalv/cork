import { AISuggestionCard } from "./AISuggestionCard";
import { BacklinksList } from "./BacklinksList";
import { NoteFolderField } from "./NoteFolderField";
import { NoteMetaFooter } from "./NoteMetaFooter";
import { Outline } from "./Outline";
import { RecentsList } from "./RecentsList";
import { TagsField } from "./TagsField";

import { useBacklinks } from "@/features/note-view/hooks/useBacklinks";
import { useOutline } from "@/features/note-view/hooks/useOutline";
import { useScrollSpy } from "@/features/note-view/hooks/useScrollSpy";
import { useNoteViewStore } from "@/features/note-view/state/noteViewStore";

import type { OutlineItem } from "@/features/note-view/hooks/useOutline";
import type { NoteEntry } from "@/shared/ipc/types";

type NoteMetaPanelProps = {
  noteId: string | null;
  body: string;
  recents: NoteEntry[];
  updated?: number;
  created?: string;
  onOpenNote: (note: NoteEntry) => void;
  onSelectHeading?: (item: OutlineItem) => void;
};

export function NoteMetaPanel({ noteId, body, recents, updated, created, onOpenNote, onSelectHeading }: NoteMetaPanelProps) {
  const collapsed = useNoteViewStore((state) => state.panelCollapsed);
  const toggleCollapsed = useNoteViewStore((state) => state.togglePanelCollapsed);
  const outline = useOutline(body);
  const activeId = useScrollSpy(outline.map((item) => item.id));
  const { backlinks } = useBacklinks(noteId);

  return (
    <aside
      aria-label="Note metadata"
      className={`${collapsed ? "hidden lg:flex" : "flex"} absolute inset-y-0 right-0 z-10 w-80 flex-col gap-5 overflow-y-auto border-l border-[var(--color-noxe-border)] bg-[var(--color-noxe-bg)] p-4 lg:static lg:flex`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        className="self-end rounded-full border border-[var(--color-noxe-border)] px-3 py-1 text-xs lg:hidden"
      >
        {collapsed ? "Show meta" : "Hide meta"}
      </button>
      <Outline items={outline} activeId={activeId} onSelect={(item) => onSelectHeading?.(item)} />
      <NoteFolderField noteId={noteId} />
      <TagsField noteId={noteId} />
      <BacklinksList backlinks={backlinks} onOpen={onOpenNote} />
      <RecentsList notes={recents} currentNoteId={noteId} onOpen={onOpenNote} />
      <AISuggestionCard />
      <NoteMetaFooter body={body} created={created} updated={updated} />
    </aside>
  );
}
