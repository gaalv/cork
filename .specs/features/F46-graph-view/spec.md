# F46 — Graph View

**Status:** IN PROGRESS · **Size:** Large

## Problem

Users want a visual map of the vault's wikilink structure. The backend is DONE: `links.graph` IPC is registered (Rust `index::links_graph`) returning `GraphData { nodes: GraphNode[], edges: GraphEdge[] }` where `GraphNode` includes `id`, `title`, `linkCount` (see IpcContract.ts:70). This feature is frontend-only.

## Requirements

- **GRPH-01 — Surface** — Graph opens as a large overlay modal in the triage layout (near-fullscreen, like an expanded CommandPalette: dimmed backdrop, rounded panel, ESC closes). Openers: palette entry "Open graph view" (hint "Graph"), sidebar row (icon `Graph` from phosphor) in the top group under Archived, and shortcut ⌘⇧G. State lives in `shellStore` (`graphOpen: boolean`).
- **GRPH-02 — Rendering** — force-directed layout on `<canvas>` (NOT SVG — vaults can have 1k nodes). Use `d3-force` (+ `d3-quadtree` transitively) ONLY — no full d3 bundle. Lazy-load the graph component (`React.lazy`) so d3 stays out of the main chunk.
- **GRPH-03 — Visuals** — nodes sized by `linkCount` (min 3px, max ~10px radius), theme tokens via CSS variables read from `getComputedStyle` (must react correctly to light/dark). Node labels appear at high zoom or on hover. Orphan notes (no links) included but visually dimmer.
- **GRPH-04 — Interactions** — pan (drag background), zoom (wheel/pinch, 0.25×–4×), hover highlights the node + its direct neighbors and dims the rest, click on a node opens the note (`openNote`) and closes the overlay. Drag a node pins it while dragging (reheats simulation gently).
- **GRPH-05 — Data lifecycle** — fetch `client.links.graph()` on open; refetch when `index:updated` fires while open. Loading + empty ("No links yet — create [[wikilinks]] to see the graph") states.
- **GRPH-06 — Performance** — simulation runs ~300 ticks then freezes (alpha decay), rAF render loop only while simulation active or interacting; must stay smooth at 1k nodes / 3k edges.

## Constraints

- Files: `src/components/modals/GraphView.tsx` (+ `src/components/modals/graph/` helpers if needed), `src/stores/shellStore.ts` (one boolean + setter), `Sidebar.tsx` (one row), `CommandPalette.tsx` (one entry), shortcut wiring. New deps: `d3-force` + `@types/d3-force` ONLY.
- No new IPC, no Rust changes.
- Respect existing conventions: theme tokens, cn(), components < 200 lines (split canvas logic into a hook `useForceGraph.ts`).

## Design (inline)

`GraphView` (modal shell, data fetch, empty/loading) → `useForceGraph(canvasRef, data, callbacks)` hook owning: d3-force simulation (forceLink distance ~60, forceManyBody -80, forceCenter, collide by radius), canvas rendering (devicePixelRatio-aware), hit-testing via quadtree for hover/click/drag, zoom/pan via canvas transform matrix. Colors resolved once per theme from CSS vars, re-resolved on `data-theme` attribute change (MutationObserver).

## Verify

`pnpm typecheck && pnpm lint && pnpm build` (graph chunk must be separate in build output). Manual: ⌘⇧G opens graph of the seeded vault; hover highlights; click opens note.
