/**
 * useForceGraph — d3-force simulation + canvas rendering for the graph view.
 *
 * Owns the simulation, DPR-aware canvas drawing, pan/zoom transform,
 * hit-testing (simulation.find), hover highlighting, and node dragging.
 * The render loop only runs while the simulation is active; interactions
 * schedule single-frame redraws.
 *
 * @see F46 — Graph View spec
 */

import { useEffect, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";

import type { GraphData } from "@/ipc/IpcContract";
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

type SimNode = SimulationNodeDatum & {
  id: string;
  title: string;
  linkCount: number;
  radius: number;
};

type SimLink = SimulationLinkDatum<SimNode>;

type Colors = {
  node: string;
  orphan: string;
  edge: string;
  label: string;
  halo: string;
};

const MIN_R = 3;
const MAX_R = 10;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const LABEL_ZOOM = 1.5;

function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    node: v("--color-cork-accent"),
    orphan: v("--color-cork-subtle"),
    edge: v("--color-cork-border-strong"),
    label: v("--color-cork-ink"),
    halo: v("--color-cork-muted"),
  };
}

function nodeRadius(linkCount: number): number {
  return Math.min(MAX_R, MIN_R + Math.sqrt(linkCount) * 1.6);
}

export function useForceGraph(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  data: GraphData | null,
  onNodeClick: (id: string) => void,
) {
  const onClickRef = useRef(onNodeClick);
  onClickRef.current = onNodeClick;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let colors = readColors();
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const view = { x: width / 2, y: height / 2, k: 1 };
    let hovered: SimNode | null = null;
    let neighbors: Set<string> | null = null;
    let dragged: SimNode | null = null;
    let panning: { startX: number; startY: number; moved: boolean } | null = null;
    let rafId = 0;
    let loopRunning = false;
    let disposed = false;

    const nodes: SimNode[] = data.nodes.map((n) => ({
      id: n.id,
      title: n.title,
      linkCount: n.linkCount,
      radius: nodeRadius(n.linkCount),
    }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = data.edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    const adjacency = new Map<string, Set<string>>();
    for (const l of links) {
      const s = l.source as string | SimNode;
      const t = l.target as string | SimNode;
      const sid = typeof s === "string" ? s : s.id;
      const tid = typeof t === "string" ? t : t.id;
      if (!adjacency.has(sid)) adjacency.set(sid, new Set());
      if (!adjacency.has(tid)) adjacency.set(tid, new Set());
      adjacency.get(sid)?.add(tid);
      adjacency.get(tid)?.add(sid);
    }

    // Manual ticking inside rAF: default alphaDecay/alphaMin settles in ~300 ticks.
    const sim: Simulation<SimNode, SimLink> = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((n) => n.id)
          .distance(60),
      )
      .force("charge", forceManyBody().strength(-80))
      .force("center", forceCenter(0, 0))
      .force(
        "collide",
        forceCollide<SimNode>((n) => n.radius + 2),
      )
      .stop();

    const toWorld = (px: number, py: number) => ({
      x: (px - view.x) / view.k,
      y: (py - view.y) / view.k,
    });

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(view.x, view.y);
      ctx.scale(view.k, view.k);

      const dimOthers = hovered !== null;
      const isFocused = (n: SimNode) =>
        hovered !== null && (n.id === hovered.id || (neighbors?.has(n.id) ?? false));

      // Edges
      ctx.lineWidth = 1 / view.k;
      for (const l of links) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        const focusedEdge = hovered !== null && (s.id === hovered.id || t.id === hovered.id);
        ctx.globalAlpha = dimOthers ? (focusedEdge ? 0.9 : 0.08) : 0.45;
        ctx.strokeStyle = colors.edge;
        ctx.beginPath();
        ctx.moveTo(s.x ?? 0, s.y ?? 0);
        ctx.lineTo(t.x ?? 0, t.y ?? 0);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const orphan = n.linkCount === 0;
        ctx.globalAlpha = dimOthers ? (isFocused(n) ? 1 : 0.12) : orphan ? 0.45 : 0.95;
        ctx.fillStyle = orphan ? colors.orphan : colors.node;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, n.radius, 0, Math.PI * 2);
        ctx.fill();
        if (hovered?.id === n.id) {
          ctx.strokeStyle = colors.halo;
          ctx.lineWidth = 2 / view.k;
          ctx.stroke();
        }
      }

      // Labels — at high zoom, or for the hovered node and its neighbors
      const showAll = view.k >= LABEL_ZOOM;
      if (showAll || hovered) {
        ctx.font = `${11 / view.k}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = colors.label;
        for (const n of nodes) {
          if (!(showAll || isFocused(n))) continue;
          ctx.globalAlpha = dimOthers && !isFocused(n) ? 0.12 : 0.9;
          ctx.fillText(n.title, n.x ?? 0, (n.y ?? 0) + n.radius + 12 / view.k);
        }
      }
      ctx.globalAlpha = 1;
    };

    const scheduleRender = () => {
      if (loopRunning || disposed) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
    };

    const loop = () => {
      if (disposed) return;
      if (sim.alpha() > sim.alphaMin()) {
        sim.tick();
        render();
        rafId = requestAnimationFrame(loop);
      } else {
        loopRunning = false;
        render();
      }
    };

    const startLoop = () => {
      if (loopRunning || disposed) return;
      loopRunning = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    };

    const findNode = (px: number, py: number): SimNode | undefined => {
      const w = toWorld(px, py);
      const n = sim.find(w.x, w.y, 24 / view.k);
      if (!n) return undefined;
      const dx = w.x - (n.x ?? 0);
      const dy = w.y - (n.y ?? 0);
      return Math.hypot(dx, dy) <= n.radius + 6 / view.k ? n : undefined;
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const node = findNode(e.offsetX, e.offsetY);
      panning = { startX: e.offsetX, startY: e.offsetY, moved: false };
      if (node) {
        dragged = node;
        node.fx = node.x;
        node.fy = node.y;
        // Gentle reheat — keep alpha above alphaMin so the rAF loop ticks.
        sim.alphaTarget(0.15);
        if (sim.alpha() < 0.05) sim.alpha(0.05);
        startLoop();
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (dragged && panning) {
        const w = toWorld(e.offsetX, e.offsetY);
        dragged.fx = w.x;
        dragged.fy = w.y;
        panning.moved = true;
        startLoop();
        return;
      }
      if (panning) {
        view.x += e.offsetX - panning.startX;
        view.y += e.offsetY - panning.startY;
        panning.startX = e.offsetX;
        panning.startY = e.offsetY;
        panning.moved = true;
        scheduleRender();
        return;
      }
      const node = findNode(e.offsetX, e.offsetY) ?? null;
      if (node !== hovered) {
        hovered = node;
        neighbors = node ? (adjacency.get(node.id) ?? new Set()) : null;
        canvas.style.cursor = node ? "pointer" : "grab";
        scheduleRender();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (dragged) {
        dragged.fx = null;
        dragged.fy = null;
        sim.alphaTarget(0);
        if (panning && !panning.moved) onClickRef.current(dragged.id);
      } else if (panning && !panning.moved) {
        const node = findNode(e.offsetX, e.offsetY);
        if (node) onClickRef.current(node.id);
      }
      dragged = null;
      panning = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.002);
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
      // Zoom toward the cursor: keep the world point under it fixed.
      view.x = e.offsetX - ((e.offsetX - view.x) / view.k) * k;
      view.y = e.offsetY - ((e.offsetY - view.y) / view.k) * k;
      view.k = k;
      scheduleRender();
    };

    const resizeObserver = new ResizeObserver(() => {
      const dx = canvas.clientWidth - width;
      const dy = canvas.clientHeight - height;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      view.x += dx / 2;
      view.y += dy / 2;
      scheduleRender();
    });
    resizeObserver.observe(canvas);

    const themeObserver = new MutationObserver(() => {
      colors = readColors();
      scheduleRender();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    startLoop();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      sim.stop();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [canvasRef, data]);
}
