/**
 * TriageBody — three-pane Inkdrop-style layout (Prototype A).
 *
 * Grid: Sidebar (260px) | Notes list (340px) | Editor (1fr)
 *
 * @see F31 — Triage Fidelity spec
 */

import { useCallback, useState } from "react";

import type { SidebarFilter } from "./helpers";
import { loadFilter, saveFilter } from "./helpers";
import { Sidebar } from "./Sidebar";
import { NotesList } from "./NotesList";
import { EditorPane, InspectorPane } from "./EditorPane";
import { StatusBar } from "./StatusBar";
import { useShellStore } from "@/features/shell/state/shellStore";

export function TriageBody() {
  const [filter, setFilterRaw] = useState<SidebarFilter>(loadFilter);
  const inspectorOpen = useShellStore((s) => s.inspectorOpen);
  const toggleInspector = useShellStore((s) => s.toggleInspector);
  const sidebarOpen = useShellStore((s) => s.sidebarOpen);

  const setFilter = useCallback((f: SidebarFilter) => {
    setFilterRaw(f);
    saveFilter(f);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-cork-bg)]">
      <div
        className={`grid min-h-0 flex-1 grid-rows-[1fr] overflow-hidden ${
          sidebarOpen
            ? inspectorOpen
              ? "grid-cols-[260px_340px_1fr_280px]"
              : "grid-cols-[260px_340px_1fr]"
            : inspectorOpen
              ? "grid-cols-[340px_1fr_280px]"
              : "grid-cols-[340px_1fr]"
        }`}
      >
        {sidebarOpen && <Sidebar filter={filter} setFilter={setFilter} />}
        <NotesList filter={filter} />
        <EditorPane inspectorOpen={inspectorOpen} onToggleInspector={toggleInspector} />
        {inspectorOpen && <InspectorPane />}
      </div>
      <StatusBar />
    </div>
  );
}
