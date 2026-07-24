/**
 * TriageBody — three-pane Inkdrop-style layout (Prototype A).
 *
 * Grid: Sidebar | Notes list | Editor | Inspector. The sidebar and list
 * widths are user-resizable (drag the column borders, persisted locally).
 * All four tracks always exist so toggling the sidebar/inspector animates
 * the track width from/to 0 instead of snapping.
 *
 * @see F31 — Triage Fidelity spec
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { SidebarFilter } from "@/utils/triageHelpers";
import { loadFilter, saveFilter } from "@/utils/triageHelpers";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { NotesList } from "@/components/notes/NotesList";
import { EditorPane, InspectorPane } from "@/components/notes/EditorPane";
import { StatusBar } from "@/components/status/StatusBar";
import { useShellStore } from "@/stores/shellStore";

const NAV_MIN = 190;
const NAV_MAX = 420;
const LIST_MIN = 260;
const LIST_MAX = 560;
const INSPECTOR_W = 300;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function readWidth(key: string, fallback: number, min: number, max: number): number {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw > 0 ? clamp(raw, min, max) : fallback;
}

export function TriageBody() {
  const [filter, setFilterRaw] = useState<SidebarFilter>(loadFilter);
  const inspectorOpen = useShellStore((s) => s.inspectorOpen);
  const toggleInspector = useShellStore((s) => s.toggleInspector);
  const sidebarOpen = useShellStore((s) => s.sidebarOpen);

  const [navW, setNavW] = useState(() => readWidth("cork.navW", 260, NAV_MIN, NAV_MAX));
  const [listW, setListW] = useState(() => readWidth("cork.listW", 340, LIST_MIN, LIST_MAX));
  const [resizing, setResizing] = useState(false);

  useEffect(() => localStorage.setItem("cork.navW", String(navW)), [navW]);
  useEffect(() => localStorage.setItem("cork.listW", String(listW)), [listW]);

  const setFilter = useCallback((f: SidebarFilter) => {
    setFilterRaw(f);
    saveFilter(f);
  }, []);

  // Apply a filter requested by an overlay (e.g. the calendar day click).
  const pendingFilter = useShellStore((s) => s.pendingFilter);
  useEffect(() => {
    if (!pendingFilter) return;
    setFilter(pendingFilter);
    useShellStore.getState().requestFilter(null);
  }, [pendingFilter, setFilter]);

  const startResize = useCallback(
    (which: "nav" | "list") => (e: React.PointerEvent) => {
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startNav = navW;
      const startList = listW;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (which === "nav") setNavW(clamp(startNav + dx, NAV_MIN, NAV_MAX));
        else setListW(clamp(startList + dx, LIST_MIN, LIST_MAX));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setResizing(false);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [navW, listW],
  );

  const sidebarW = sidebarOpen ? navW : 0;
  const inspectorW = inspectorOpen ? INSPECTOR_W : 0;
  const gridTemplateColumns = `${sidebarW}px ${listW}px minmax(0,1fr) ${inspectorW}px`;

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-cork-bg)]">
      <div
        className={`relative grid min-h-0 flex-1 grid-rows-[1fr] overflow-hidden ${
          resizing ? "" : "transition-[grid-template-columns] duration-200 ease-out"
        }`}
        style={{ gridTemplateColumns }}
      >
        <div
          className="min-w-0 overflow-hidden"
          aria-hidden={!sidebarOpen}
          style={{ pointerEvents: sidebarOpen ? undefined : "none" }}
        >
          <Sidebar filter={filter} setFilter={setFilter} />
        </div>
        <div className="min-w-0 overflow-hidden">
          <NotesList filter={filter} />
        </div>
        <div className="min-w-0 overflow-hidden">
          <EditorPane inspectorOpen={inspectorOpen} onToggleInspector={toggleInspector} />
        </div>
        <div className="min-w-0 overflow-hidden" aria-hidden={!inspectorOpen}>
          {inspectorOpen && <InspectorPane />}
        </div>

        {/* Drag-to-resize handles sit on the column borders. */}
        {sidebarOpen && <ResizeHandle left={sidebarW} onPointerDown={startResize("nav")} />}
        <ResizeHandle left={sidebarW + listW} onPointerDown={startResize("list")} />
      </div>
      <StatusBar />
    </div>
  );
}

function ResizeHandle({
  left,
  onPointerDown,
}: {
  left: number;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        ref.current?.setPointerCapture(e.pointerId);
        onPointerDown(e);
      }}
      className="group absolute top-0 bottom-0 z-20 w-2 -translate-x-1/2 cursor-col-resize"
      style={{ left }}
    >
      <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-[var(--color-cork-accent)]" />
    </div>
  );
}
