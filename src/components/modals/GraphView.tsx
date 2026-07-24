/**
 * GraphView — near-fullscreen force-directed graph of the vault's wikilinks.
 *
 * Lazy-loaded (React.lazy in Shell) so d3-force stays out of the main chunk.
 * Canvas rendering + simulation live in useForceGraph.
 *
 * @see F46 — Graph View spec
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleNotch, Graph, X } from "@phosphor-icons/react";

import { client } from "@/ipc/client";
import { useForceGraph } from "@/hooks/useForceGraph";
import { useShellStore } from "@/stores/shellStore";
import type { GraphData } from "@/ipc/IpcContract";

export function GraphView() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const close = useShellStore((s) => s.setGraphOpen);
  const openNote = useShellStore((s) => s.openNote);

  // Fetch on open; refetch when the indexer reports changes while open.
  useEffect(() => {
    let cancelled = false;
    const fetchGraph = async () => {
      try {
        const result = await client.links.graph();
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchGraph();
    const unlisten = client.events.on("index:updated", () => void fetchGraph());
    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, []);

  const handleNodeClick = useCallback(
    (id: string) => {
      openNote(id);
      close(false);
    },
    [close, openNote],
  );

  useForceGraph(canvasRef, data, handleNodeClick);

  const empty = !loading && (data === null || data.edges.length === 0);

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--color-cork-ink)]/30 p-8"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-cork-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Graph size={16} className="text-[var(--color-cork-muted)]" />
            <h2 className="text-[14px] font-semibold">Graph</h2>
            {data && !empty && (
              <span className="text-[11px] text-[var(--color-cork-subtle)]">
                {data.nodes.length} notes · {data.edges.length} links
              </span>
            )}
          </div>
          <button
            onClick={() => close(false)}
            className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-[13px] text-[var(--color-cork-muted)]">
              <CircleNotch size={16} className="animate-spin" />
              Building graph…
            </div>
          )}
          {empty && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <Graph size={28} className="text-[var(--color-cork-subtle)]" />
              <p className="text-[13px] text-[var(--color-cork-muted)]">
                No links yet — create [[wikilinks]] to see the graph
              </p>
            </div>
          )}
          {!loading && !empty && <canvas ref={canvasRef} className="h-full w-full touch-none" />}
        </div>
      </div>
    </div>
  );
}
