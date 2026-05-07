import { useEffect, useMemo, useRef, useState } from "react";

import { useShellStore } from "@/features/shell/state/shellStore";
import { client } from "@/shared/ipc/client";

import type { GraphData, GraphNode } from "@/shared/ipc/IpcContract";

type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };
type SimEdge = { source: SimNode; target: SimNode };

const WIDTH = 1200;
const HEIGHT = 800;
const NODE_RADIUS = 4;

export function GraphView() {
  const navigate = useShellStore((state) => state.navigate);
  const [data, setData] = useState<GraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [, setTick] = useState(0);
  const nodesRef = useRef<Map<string, SimNode>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const load = async () => {
      try {
        const next = await client.links.graph();
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load graph");
        }
      }
    };
    void load();
    void client.events
      .on("index:updated", () => void load())
      .then((un) => {
        if (cancelled) un();
        else unlisten = un;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const sim = useMemo(() => {
    if (!data) return { nodes: [] as SimNode[], edges: [] as SimEdge[] };
    const map = new Map<string, SimNode>();
    const count = data.nodes.length || 1;
    data.nodes.forEach((node, index) => {
      const previous = nodesRef.current.get(node.id);
      const angle = (index / count) * Math.PI * 2;
      const radius = Math.min(WIDTH, HEIGHT) * 0.35;
      map.set(node.id, {
        ...node,
        x: previous?.x ?? WIDTH / 2 + Math.cos(angle) * radius,
        y: previous?.y ?? HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      });
    });
    nodesRef.current = map;
    const nodes = Array.from(map.values());
    const edges: SimEdge[] = [];
    for (const edge of data.edges) {
      const source = map.get(edge.source);
      const target = map.get(edge.target);
      if (source && target) edges.push({ source, target });
    }
    return { nodes, edges };
  }, [data]);

  useEffect(() => {
    if (sim.nodes.length === 0) return undefined;
    let raf = 0;
    let iterations = 0;
    const cap = 320;
    const repulsion = 1800;
    const linkDistance = 80;
    const linkStrength = 0.04;
    const centerStrength = 0.005;
    const damping = 0.85;

    const step = () => {
      const { nodes, edges } = sim;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy + 0.01;
          const force = repulsion / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
      for (const edge of edges) {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const diff = (dist - linkDistance) * linkStrength;
        const fx = (dx / dist) * diff;
        const fy = (dy / dist) * diff;
        edge.source.vx += fx;
        edge.source.vy += fy;
        edge.target.vx -= fx;
        edge.target.vy -= fy;
      }
      for (const node of nodes) {
        node.vx += (WIDTH / 2 - node.x) * centerStrength;
        node.vy += (HEIGHT / 2 - node.y) * centerStrength;
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      }
      iterations += 1;
      setTick((value) => value + 1);
      if (iterations < cap) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  const filterTrim = filter.trim().toLowerCase();
  const matches = (node: SimNode) =>
    !filterTrim || node.title.toLowerCase().includes(filterTrim) || node.folder.toLowerCase().includes(filterTrim);

  const totalNodes = sim.nodes.length;
  const totalEdges = sim.edges.length;

  return (
    <section data-testid="graph-view" className="flex h-full min-h-0 flex-col gap-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-wide text-[var(--color-noxe-muted)]">Graph</p>
          <h1 className="text-xl font-semibold text-[var(--color-noxe-ink)]">Backlinks</h1>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[var(--color-noxe-muted)]">
          <input
            type="search"
            placeholder="Filter notes…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-full border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)] px-3 py-1.5 text-[12px] text-[var(--color-noxe-ink)] outline-none focus-visible:border-[var(--color-noxe-border-strong)]"
            aria-label="Filter graph nodes"
          />
          <span>
            {totalNodes} note{totalNodes === 1 ? "" : "s"} · {totalEdges} link{totalEdges === 1 ? "" : "s"}
          </span>
        </div>
      </header>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {totalNodes === 0 && !error ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--color-noxe-border)] p-8 text-sm text-[var(--color-noxe-muted)]">
          No notes yet. Create some notes and link them with [[wikilinks]] to see the graph come alive.
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel)]">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full"
            role="img"
            aria-label="Notes graph"
          >
            <g>
              {sim.edges.map((edge, index) => {
                const dim = filterTrim !== "" && !matches(edge.source) && !matches(edge.target);
                return (
                  <line
                    key={`e-${index}`}
                    x1={edge.source.x}
                    y1={edge.source.y}
                    x2={edge.target.x}
                    y2={edge.target.y}
                    stroke="currentColor"
                    strokeOpacity={dim ? 0.05 : 0.2}
                    className="text-[var(--color-noxe-muted)]"
                  />
                );
              })}
              {sim.nodes.map((node) => {
                const isHovered = hovered === node.id;
                const dim = filterTrim !== "" && !matches(node);
                const radius = NODE_RADIUS + Math.min(8, Math.sqrt(node.linkCount));
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    style={{ cursor: "pointer", opacity: dim ? 0.2 : 1 }}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered((current) => (current === node.id ? null : current))}
                    onClick={() => navigate({ kind: "note", id: node.id })}
                  >
                    <circle
                      r={radius}
                      fill="currentColor"
                      className={isHovered ? "text-[var(--color-noxe-primary)]" : "text-[var(--color-noxe-ink)]"}
                    />
                    {isHovered || (filterTrim !== "" && matches(node)) ? (
                      <text
                        x={radius + 4}
                        y={4}
                        fontSize={12}
                        fill="currentColor"
                        className="text-[var(--color-noxe-ink)]"
                      >
                        {node.title}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
    </section>
  );
}
