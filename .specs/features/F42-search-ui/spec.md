# F42 — Full-text Search UI

**Status:** IN PROGRESS · **Size:** Medium (spec only, design inline)

## Problem

The FTS5 backend (`index.search` IPC, `SearchResult` with snippet + rank) is fully built but no UI calls it. The ⌘K palette filters by title/path only. Users cannot find notes by content.

## Requirements

- **SRCH-01** — The command palette (⌘K) searches note **content** via `client.index.search` when the query has ≥ 2 chars, debounced ~150ms. Results appear in a "Content matches" section below the existing title-match "Notes" section, deduplicated against title matches, capped at 8.
- **SRCH-02** — Content results show the note title + the FTS snippet (highlight `<b>`/`match` markers stripped or rendered as emphasis using safe rendering — NO dangerouslySetInnerHTML of raw FTS output).
- **SRCH-03** — Selecting a content result opens the note (same `openNote` flow). Keyboard navigation (↑/↓/Enter) spans title matches → content matches → commands seamlessly.
- **SRCH-04** — IPC failure or empty index degrades silently to today's behavior (title matches only, no error toast).
- **SRCH-05** — No new IPC, no Rust changes. `indexStore.search` is the only data path.

## Constraints

- Files: `src/components/modals/CommandPalette.tsx` (primary). Keep component < 200 lines by extracting a `usePaletteSearch` hook or a `paletteSearch.ts` helper if needed.
- Follow existing PaletteSection/PaletteRow primitives; theme tokens only.

## Verify

`pnpm typecheck && pnpm lint`. Manual: type a word that appears only in a note's body → note appears under "Content matches"; Enter opens it.
