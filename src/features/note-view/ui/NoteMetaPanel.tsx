import { InsightsCard } from "@/features/ai/ui/InsightsCard";
import { BacklinksList } from "./BacklinksList";
import { NoteProperties } from "./NoteProperties";
import { Outline } from "./Outline";

import { useBacklinks } from "@/features/note-view/hooks/useBacklinks";
import { useOutline } from "@/features/note-view/hooks/useOutline";
import { useScrollSpy } from "@/features/note-view/hooks/useScrollSpy";
import { useNoteViewStore } from "@/features/note-view/state/noteViewStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { NoteHistory } from "@/features/vcs/ui/NoteHistory";

import type { OutlineItem } from "@/features/note-view/hooks/useOutline";
import type { NoteEntry } from "@/shared/ipc/types";

type NoteMetaPanelProps = {
  noteId: string | null;
  body: string;
  updated?: number;
  created?: string;
  onOpenNote: (note: NoteEntry) => void;
  onSelectHeading?: (item: OutlineItem) => void;
};

export function NoteMetaPanel({ noteId, body, onOpenNote, onSelectHeading }: NoteMetaPanelProps) {
  const collapsed = useNoteViewStore((state) => state.panelCollapsed);
  const toggleCollapsed = useNoteViewStore((state) => state.togglePanelCollapsed);
  const activeNotePath = useNoteViewStore((state) => state.activeNotePath);
  const noteTitle = useVaultStore((state) =>
    noteId ? (state.notes.find((note) => note.id === noteId)?.title ?? "") : "",
  );
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
      <NoteProperties noteId={noteId} body={body} />
      <InsightsCard noteId={noteId} body={body} title={noteTitle} />
      <NoteHistory notePath={activeNotePath} noteId={noteId} />
      <BacklinksList backlinks={backlinks} onOpen={onOpenNote} />
    </aside>
  );
}
