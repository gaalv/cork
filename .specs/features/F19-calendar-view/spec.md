# F19 — Calendar / Agenda View (v0 + v1)

## Overview

A dedicated Calendar screen that surfaces daily notes and event-pinned notes in a month grid. Accessible from the sidebar rail; no external calendar integration in this release.

Google Calendar OAuth, week view, and day view are explicitly **deferred** (see DEFERRED.md § D1 updated).

---

## Requirements

### R1 – Calendar screen entry point
- **R1.1** A "Calendar" button appears in the sidebar Rail below the "Home" button and above the drawer buttons.
- **R1.2** The button uses the `CalendarBlank` icon from `@phosphor-icons/react` (matching Rail icon conventions) with label "Calendar".
- **R1.3** Clicking the button navigates to `{ kind: "calendar" }` view, dismissing any open drawer. The button is `aria-pressed="true"` when the calendar view is active.
- **R1.4** Optional: `Cmd+Shift+C` keyboard shortcut navigates to the calendar view (only if shortcut wiring is trivial to add alongside existing shortcuts).

### R2 – Month grid (v0)
- **R2.1** The grid shows a 7-column day-of-week header (Sun → Sat) and up to 6 rows of day cells covering the full calendar month (including leading/trailing days from adjacent months).
- **R2.2** The current month name and year are displayed above the grid (e.g. "June 2026").
- **R2.3** Prev (‹) and Next (›) buttons navigate one month at a time.
- **R2.4** A "Today" button resets the viewed month to the current month and selects today's date.
- **R2.5** Today's date cell is visually highlighted with a distinct background or ring.
- **R2.6** Days outside the current month (leading/trailing) are rendered with reduced opacity.

### R3 – Day cell note indicators (v0)
- **R3.1** If a daily note exists for a day (resolved by matching the note's path against the configured `dailyPathPattern`), the day cell shows a visual indicator (a small dot or count badge).
- **R3.2** If any notes have a frontmatter `event` field equal to the day's ISO date (`YYYY-MM-DD`), they are also counted in the indicator.
- **R3.3** The total note count (daily + event notes) is shown when > 0.

### R4 – Day cell interaction (v0)
- **R4.1** Clicking a day cell selects it (stores `selectedDate` in the calendar store).
- **R4.2** If a daily note exists for the selected date, the app navigates immediately to that note (opens it in the editor).
- **R4.3** If no daily note exists, the click selects the day and the Agenda panel (R5) shows a "Create daily note for YYYY-MM-DD" action.

### R5 – Agenda panel (v1)
- **R5.1** When a date is selected, an Agenda panel slides in on the right side of the CalendarView.
- **R5.2** The panel header shows the selected date in a human-readable format (e.g. "Wednesday, June 4, 2026").
- **R5.3** The panel lists all notes for that day: the daily note (if any) followed by event notes, each as a clickable row.
- **R5.4** Clicking a note row navigates to that note in the editor.
- **R5.5** If no daily note exists, a "Create daily note" button is shown; clicking it calls the existing `openOrCreateToday` function (or equivalent) then navigates to the new note.
- **R5.6** If no notes exist for the selected day, the panel shows a brief "No notes for this day" message.
- **R5.7** The panel is dismissible: clicking outside it or pressing Escape deselects the date.

### R6 – Calendar store
- **R6.1** A Zustand store `useCalendarStore` holds: `viewMonth: Date` (first day of displayed month), `selectedDate: Date | null`.
- **R6.2** Actions: `goToMonth(year, month)`, `goToPrevMonth()`, `goToNextMonth()`, `goToday()`, `selectDate(date: Date | null)`.
- **R6.3** `goToday()` sets `viewMonth` to the first day of the current calendar month and sets `selectedDate` to today.

### R7 – Shell integration
- **R7.1** `ShellView` type is extended with `{ kind: "calendar" }`.
- **R7.2** `ViewRouter` renders `<CalendarView />` when `view.kind === "calendar"`.
- **R7.3** The `isShellView` persistence guard accepts `kind: "calendar"`.
- **R7.4** Pressing Escape from the calendar view (with no drawer open) navigates back to home.

---

## Out of scope (deferred)
- Google Calendar OAuth / sync (D1 remainder)
- Week view, day view
- Drag-to-create events
- Recurring events
- Settings flag to configure calendar source

---

## Acceptance criteria
- `pnpm typecheck` passes.
- `pnpm test` passes (all 229 existing tests + new F19 tests).
- `pnpm build` succeeds.
- Sidebar shows a Calendar button; clicking it opens the month grid.
- Today's cell is highlighted; prev/next/today work.
- Days with daily notes show a dot indicator.
- Clicking a day with a daily note opens the note editor.
- Clicking a day without a daily note shows the Agenda panel with a "Create daily note" option.
- Agenda panel lists all notes for the selected day, each clickable.
- spec.md, design.md, tasks.md exist and are coherent.
- DEFERRED.md updated to reflect D1 partial completion.
