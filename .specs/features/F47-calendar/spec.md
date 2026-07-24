# F47 — Calendar

**Status:** PLANNED · **Size:** Large · **Milestone:** M14

## Problem

Journaling users (the app's core audience) want to browse their notes by date and jump between daily notes — the Obsidian Calendar plugin workflow the user relied on. Daily notes (F43) exist but are only reachable as "today" (⌘⇧T) or by manually opening the `Daily/` folder; there is no way to see which days have notes, no month overview, and no way to open a past/future day's note.

## Premises (locked by user)

- **The sidebar stays filters-only.** No calendar in the sidebar. The calendar is reached from the **status bar**, opening as an **overlay modal** — the exact pattern of the Graph view (F46): status-bar icon + palette entry + shortcut, dimmed backdrop, ESC to close.
- **Not the focus of the app.** Strictly a month grid + day markers + click. **Out of scope:** events, times/scheduling, week/day views, drag, recurring items, iCal.
- **Activity source is note creation date (`ctime`).** Every note already carries `ctime`; "what did I write on this day" needs no user effort and no new frontmatter. A `date:` frontmatter override is a possible future extension, not v1.

## Requirements

- **CAL-01 — Surface & openers.** `calendarOpen: boolean` in `shellStore`. Openers: (1) a `CalendarBlank` (Phosphor) icon in the `StatusBar` right cluster, next to the Graph icon; (2) palette entry "Open calendar" (hint "Calendar"); (3) shortcut ⌘⇧Y (verify no collision — bound ⌘⇧ keys today are L/T/G; global ⌘⇧I). Overlay modal centered like `GraphView`/`CommandPalette`: dimmed backdrop, rounded panel, ESC and backdrop-click close, wired through the same `useShortcuts` Escape/`hasOverlay` chain as the other overlays.
- **CAL-02 — Month grid.** A single month (weeks as rows, weekday headers), "today" visually marked, current month label with ‹ › month navigation and a "Today" button that returns to the current month. Week start is Monday (dev-audience default; a setting is out of scope).
- **CAL-03 — Day markers.** Each day cell shows: (a) a filled **dot** when a daily note exists for that date (a note whose vault-relative path equals the resolved daily pattern for that date, per F43's `resolveDailyPath`); (b) an **activity intensity** cue (subtle background heat or a small count) derived from the number of notes whose `ctime` falls on that local date. Days with neither are plain. All via theme tokens, no hardcoded hex.
- **CAL-04 — Click a day (the tie).** Clicking a day does BOTH: (1) opens — creating if missing — that day's **daily note** (generalize F43's `openDailyNote` to accept a target `Date`; reuses template/plain-note creation and same-day idempotency); (2) sets the NotesList filter to that day so the middle column shows every note authored that day; (3) closes the overlay.
- **CAL-05 — Date filter.** New `SidebarFilter` variant `{ kind: "date"; date: string /* YYYY-MM-DD */ }`. `NotesList` filters `allNotes` to notes whose `ctime` is on that local date; scope label reads the formatted date (e.g. "Jul 24, 2026"). Sorting/other list behavior unchanged. The filter is set programmatically by the calendar (no sidebar row); it persists through the existing `saveFilter` path so a reload keeps the day view.
- **CAL-06 — Data lifecycle.** Markers and counts derive **client-side** from the already-loaded `useVaultStore` notes (each has `ctime` and `path`) — **no new IPC, no Rust changes**. The grid recomputes when the notes list changes (vault load, `index:updated`-driven reloads) so creating a note updates the heat. Empty months render plainly (no error state needed).
- **CAL-07 — Performance.** Grouping notes by local `ctime` date is memoized (`Map<YYYY-MM-DD, count>` built once per notes-list change), so month navigation is pure lookup. Must stay smooth on a 1k-note vault.

## Design (inline)

```
StatusBar (F47 icon) ─┐  palette "Open calendar" ─┐  ⌘⇧Y ─┐
                      └──────────► shellStore.calendarOpen = true ──► <CalendarOverlay/>
CalendarOverlay
  ├─ builds Map<"YYYY-MM-DD", { count, hasDaily }> from useVaultStore.notes (memoized)
  ├─ month state (viewYear, viewMonth) + ‹ › + Today
  ├─ renders 6×7 grid; each cell: day number + dot (hasDaily) + heat (count)
  └─ onDayClick(date):
        → openDailyNote(date)                // generalized from F43
        → setFilter({ kind: "date", date })  // via the TriageBody setter path
        → shellStore.setCalendarOpen(false)
```

- **`openDailyNote(date?: Date)`** — F43's service gains an optional date param; `expandDateTokens`/`resolveDailyPath` take the target date instead of always `new Date()`. No behavior change for the no-arg (today) callers.
- **Filter wiring** — the calendar needs the `setFilter` from `TriageBody`. Either lift a `setFilter` action into a store, or route the day-click through a small shared handler. Prefer the least invasive path that reuses `saveFilter` (design choice for the implementer; `shellStore` already coordinates cross-column intent).
- **Local date key** — use local `YYYY-MM-DD` (zero-padded) consistently for both the `ctime` grouping and the daily-note path match, matching F43's local-time convention.

## Constraints

- Files (expected): `src/components/modals/CalendarOverlay.tsx` (new, lazy-loaded like GraphView), `src/stores/shellStore.ts` (boolean + setter + reset), `src/screens/Shell.tsx` (lazy mount), `src/components/status/StatusBar.tsx` (icon), `src/components/modals/CommandPalette.tsx` (entry), `src/hooks/useShortcuts.ts` (⌘⇧Y + Escape/hasOverlay), `src/services/dailyNote.ts` (date param), `src/utils/triageHelpers.ts` (`SidebarFilter` union), `src/components/notes/NotesList.tsx` (date filter branch + label).
- Component < 200 lines (split grid/date math into a helper or `useMonthGrid` hook). No new deps — plain date math, no date library. Theme tokens only.

## Verify

`pnpm typecheck && pnpm lint && pnpm build` (calendar in its own lazy chunk). Manual: status-bar calendar icon opens the overlay; days with daily notes show a dot and busy days show heat; clicking a day opens/creates that day's daily note and filters the list to that date; ESC closes; ⌘⇧Y toggles.
