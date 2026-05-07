import { AllNotesGrid } from "./AllNotesGrid";
import { HomeHero } from "./HomeHero";
import { PinnedGrid } from "./PinnedGrid";
import { RecentsList } from "./RecentsList";
import { HomeSkeletons } from "./Skeletons";
import { TagPills } from "./TagPills";

import { useHomeSections } from "@/features/home/hooks/useHomeSections";
import { usePinToggle } from "@/features/home/hooks/usePinToggle";
import { useShellStore } from "@/features/shell/state/shellStore";

import type { NoteEntry } from "@/shared/ipc/types";

export function HomeView() {
  const sections = useHomeSections();
  const navigate = useShellStore((state) => state.navigate);
  const { togglePin } = usePinToggle(sections.refresh);
  const openNote = (note: NoteEntry) => navigate({ kind: "note", id: note.id });
  const togglePinAction = async (note: NoteEntry) => {
    void (await togglePin(note));
  };
  const isEmpty = !sections.isLoading && sections.allPage.length === 0 && sections.recents.length === 0;

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto p-6 lg:p-10" data-testid="home-view">
      {sections.isLoading && sections.allPage.length === 0 ? (
        <HomeSkeletons />
      ) : (
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <HomeHero />
          {isEmpty ? <EmptyHome /> : null}
          <PinnedGrid notes={sections.pinned} onOpen={openNote} onPinToggle={togglePinAction} onChanged={sections.refresh} />
          <RecentsList notes={sections.recents} onOpen={openNote} />
          <TagPills tags={sections.tagsTop} />
          <AllNotesGrid
            notes={sections.allPage}
            hasMore={sections.hasMore}
            onLoadMore={sections.loadMore}
            onOpen={openNote}
            onPinToggle={togglePinAction}
            onChanged={sections.refresh}
          />
          {sections.error ? <p className="text-sm text-red-600">Using local vault data: {sections.error}</p> : null}
        </div>
      )}
    </main>
  );
}

function EmptyHome() {
  return (
    <section className="rounded-3xl border border-dashed border-[var(--color-noxe-border)] p-8 text-center">
      <h2 className="text-xl font-semibold">Create your first note</h2>
      <p className="mt-2 text-sm text-[var(--color-noxe-muted)]">Use ⌘N or the command palette to add Markdown files.</p>
    </section>
  );
}
