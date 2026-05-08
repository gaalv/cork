import { useEffect } from "react";
import { FileText } from "@phosphor-icons/react";

import { CalendarView } from "@/features/calendar/ui/CalendarView";
import { GraphView } from "@/features/graph/ui/GraphView";
import { NoteView } from "@/features/note-view/ui/NoteView";
import { TodosView } from "@/features/todos/ui/TodosView";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { Splitter } from "@/features/shell/ui/Splitter";
import { useShellStore } from "@/features/shell/state/shellStore";
import {
  useTriageOverlayStore,
  type TriageOverlayKind,
} from "@/features/shell/state/triageOverlayStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { ListPane } from "./ListPane";
import { NavPane } from "./NavPane";
import { TriageNoteToolbar } from "./TriageNoteToolbar";

export function TriageBody() {
  const navWidth = useAppSettingsStore((state) => state.settings.layout.triageNavWidth);
  const listWidth = useAppSettingsStore((state) => state.settings.layout.triageListWidth);
  const setTriageWidths = useAppSettingsStore((state) => state.setTriageWidths);

  return (
    <div data-testid="triage-body" className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <Splitter
        panels={[
          { id: "nav", size: navWidth, min: 200, max: 360 },
          { id: "list", size: listWidth, min: 280, max: 480 },
          { id: "view", size: "fill" },
        ]}
        onResize={(sizes) => {
          void setTriageWidths({ nav: sizes.nav, list: sizes.list });
        }}
      >
        <NavPane />
        <ListPane />
        <TriageMain />
      </Splitter>
      <TriageToolOverlay />
    </div>
  );
}

function TriageMain() {
  const view = useShellStore((state) => state.view);
  const notes = useVaultStore((state) => state.notes);

  if (view.kind === "note") {
    const note = notes.find((candidate) => candidate.id === view.id);
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <TriageNoteToolbar noteId={view.id} />
        <div className="flex min-h-0 flex-1">
          <NoteView title={note?.title ?? "Untitled"} noteId={view.id} />
        </div>
      </div>
    );
  }

  return <NotePlaceholder />;
}

function NotePlaceholder() {
  return (
    <div
      data-testid="triage-empty-placeholder"
      className="flex h-full items-center justify-center bg-[var(--color-noxe-bg)] text-center"
    >
      <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-[var(--color-noxe-muted)]">
        <FileText size={36} weight="duotone" />
        <p className="text-sm font-medium text-[var(--color-noxe-ink)]">
          Select a note to start reading
        </p>
        <p className="text-xs">
          Pick something from the list, or hit{" "}
          <kbd className="rounded border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] px-1 text-[10px]">
            ⌘N
          </kbd>{" "}
          to create one.
        </p>
      </div>
    </div>
  );
}

const OVERLAY_TITLES: Record<TriageOverlayKind, string> = {
  graph: "Graph",
  calendar: "Calendar",
  todos: "Todos",
};

function TriageToolOverlay() {
  const kind = useTriageOverlayStore((state) => state.kind);
  const close = useTriageOverlayStore((state) => state.close);

  useEffect(() => {
    if (!kind) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, kind]);

  if (!kind) return null;

  return (
    <div
      data-testid={`triage-overlay-${kind}`}
      className="absolute inset-0 z-30 flex items-stretch justify-stretch bg-black/30 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={OVERLAY_TITLES[kind]}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="m-6 flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] shadow-2xl">
        <header className="flex h-11 items-center justify-between border-b border-[var(--color-noxe-border)] px-4">
          <span className="text-sm font-semibold text-[var(--color-noxe-ink)]">
            {OVERLAY_TITLES[kind]}
          </span>
          <button
            type="button"
            onClick={close}
            className="rounded px-2 py-1 text-xs text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)]"
            aria-label="Close"
          >
            Esc · Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {kind === "graph" ? <GraphView /> : null}
          {kind === "calendar" ? <CalendarView /> : null}
          {kind === "todos" ? <TodosView /> : null}
        </div>
      </div>
    </div>
  );
}
