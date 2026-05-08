import { useState } from "react";

import { AllNotesGrid } from "./AllNotesGrid";
import { HomeHero } from "./HomeHero";
import { OpenTodosCard } from "./OpenTodosCard";
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
  const [showAll, setShowAll] = useState(false);
  const openNote = (note: NoteEntry) => navigate({ kind: "note", id: note.id });
  const openTodos = () => navigate({ kind: "todos" });
  const togglePinAction = async (note: NoteEntry) => {
    void (await togglePin(note));
  };
  const isEmpty =
    !sections.isLoading && sections.allPage.length === 0 && sections.recents.length === 0;

  return (
    <main className="h-full min-h-0 flex-1 overflow-y-auto p-6 lg:p-10" data-testid="home-view">
      {sections.isLoading && sections.allPage.length === 0 ? (
        <HomeSkeletons />
      ) : (
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <HomeHero />
          {isEmpty ? <EmptyHome /> : null}
          <PinnedGrid
            notes={sections.starred}
            onOpen={openNote}
            onPinToggle={togglePinAction}
            onChanged={sections.refresh}
          />
          <OpenTodosCard
            todos={sections.todos}
            doneThisWeek={sections.todosDoneThisWeek}
            onToggle={(id) => void sections.toggleTodo(id)}
            onOpenAll={openTodos}
          />
          <RecentsList notes={sections.recents} onOpen={openNote} />
          <TagPills tags={sections.tagsTop} />

          {showAll ? (
            <>
              <AllNotesGrid
                notes={sections.allPage}
                hasMore={sections.hasMore}
                onLoadMore={sections.loadMore}
                onOpen={openNote}
                onPinToggle={togglePinAction}
                onChanged={sections.refresh}
                flagsByPath={sections.flagsByPath}
              />
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
                >
                  Hide all notes
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                data-testid="home-browse-all"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-noxe-muted)] hover:text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
              >
                Browse all notes →
              </button>
            </div>
          )}

          {sections.error ? (
            <p className="text-sm text-red-600">Using local vault data: {sections.error}</p>
          ) : null}
        </div>
      )}
    </main>
  );
}

function EmptyHome() {
  return (
    <section className="rounded-3xl border border-dashed border-[var(--color-noxe-border)] p-8 text-center">
      <h2 className="text-xl font-semibold">Create your first note</h2>
      <p className="mt-2 text-sm text-[var(--color-noxe-muted)]">
        Use ⌘N or the command palette to add Markdown files.
      </p>
    </section>
  );
}
