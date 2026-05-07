# F19 — Design

## Architecture overview

```
┌────────────────────────────────────────────────────────┐
│  Shell layer                                           │
│                                                        │
│  shellStore.view: ShellView ──► "calendar"             │
│       │                                                │
│       ▼                                                │
│  ViewRouter ──► CalendarView                           │
│                                                        │
│  Rail ──► CalendarBlank icon ──► navigate("calendar")  │
└────────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────┐
│  Calendar feature                                      │
│                                                        │
│  calendarStore (Zustand)                               │
│    viewMonth: Date   selectedDate: Date | null         │
│    goToMonth / goToPrevMonth / goToNextMonth / goToday │
│    selectDate                                          │
│                                                        │
│  calendarService (pure functions)                      │
│    buildMonthGrid(year, month) → Date[][]              │
│    dateToISO(date) → string                            │
│    isDailyNoteForDate(path, date, pattern?) → boolean  │
│    aggregateNotesForMonth(notes, y, m, pattern?)       │
│      → Map<dateISO, NoteSummary[]>                     │
│                                                        │
│  UI                                                    │
│    CalendarView ── (MonthGrid + AgendaPanel)           │
│       MonthGrid                                        │
│         ── 7-col DOW header                            │
│         ── 6 rows × DayCell                            │
│       AgendaPanel                                      │
│         ── note list rows                              │
│         ── "Create daily note" CTA                     │
└────────────────────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────────────────────┐
│  Existing services (unchanged)                         │
│                                                        │
│  dailyService.openOrCreateToday(date)                  │
│  dailyService.computeDailyPath(date, pattern)          │
│  useVaultStore.notes                                   │
│  useAppSettingsStore.dailyPathPattern                  │
└────────────────────────────────────────────────────────┘
```

## Data model

### NoteSummary (calendar-local type)
```ts
type NoteSummary = {
  id: string;
  path: string;
  title: string;
  eventDate?: string; // ISO date from frontmatter.event (pre-enriched by hook)
};
```
`NoteEntry` (from vault store) is cast to `NoteSummary`; the `eventDate` field is populated by a hook that reads each note's frontmatter asynchronously on first month load.

### calendarStore
```ts
type CalendarStore = {
  viewMonth: Date;          // always the 1st of the displayed month
  selectedDate: Date | null;
  goToMonth: (year: number, month: number) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToday: () => void;
  selectDate: (date: Date | null) => void;
};
```

### aggregateNotesForMonth return shape
```
Map<"2026-06-01", [{ id, path, title }]>
Map<"2026-06-03", [{ id, path, title }]>
...
```
Keys are only present for days with at least one note.

## Component tree

```
CalendarView
├── header (month title + prev/today/next)
├── MonthGrid
│   ├── DOW header row (Sun…Sat)
│   └── grid rows
│       └── DayCell × 42
└── AgendaPanel (conditional, shown when selectedDate != null)
    ├── date heading
    ├── note list (NoteRow × n)
    └── "Create daily note" button (when no daily note)
```

## Key design decisions

### 1. Icon library
Use `CalendarBlank` from `@phosphor-icons/react` (existing library in the project) rather than lucide, to match all existing Rail icons.

### 2. No new routing library
Add `{ kind: "calendar" }` to the existing `ShellView` discriminated union and extend `ViewRouter` with an additional branch. No `react-router` or similar introduced.

### 3. Frontmatter event detection
`NoteEntry` (from vault index) does not include frontmatter. The `aggregateNotesForMonth` service function accepts `NoteSummary[]` which has an optional `eventDate` field. A `useCalendarNotes` hook in CalendarView loads event-date frontmatter from each note lazily (via `client.notes.read`) the first time a month is displayed, caching results so navigation between months stays fast.

For v0 (minimal), only daily-note path matching is implemented; event-date enrichment can be performed incrementally.

### 4. Daily note resolution
The same path-comparison approach used internally by `dailyService`:
```
note.path.endsWith("/" + computeDailyPath(date, pattern).replace(/\\/g, "/"))
```
This means no new IPC commands are required.

### 5. Agenda panel opens alongside grid (not modal)
The panel slides in as a fixed-width right column inside `CalendarView`; the grid shrinks to accommodate it. This matches the drawer-host pattern already in the shell.

### 6. Escape handling
`CalendarView` adds a `keydown` listener for `Escape`. If `selectedDate` is set, it deselects. Otherwise it navigates back to `home` (matching the existing `NoteView` → `HomeView` Escape behaviour in `ViewRouter`).

## File layout

```
src/features/calendar/
├── state/
│   └── calendarStore.ts
├── services/
│   ├── calendarService.ts
│   └── calendarService.test.ts
└── ui/
    ├── CalendarView.tsx
    ├── CalendarView.test.tsx
    ├── MonthGrid.tsx
    ├── MonthGrid.test.tsx
    ├── DayCell.tsx
    ├── DayCell.test.tsx
    └── AgendaPanel.tsx
```

## Shell changes

| File | Change |
|------|--------|
| `shellStore.ts` | Add `{ kind: "calendar" }` to `ShellView`; update `isShellView` guard |
| `ViewRouter.tsx` | Add `view.kind === "calendar"` branch → `<CalendarView />` |
| `Rail.tsx` | Add Calendar nav button below Home, above drawer buttons |

## Dependencies added
None — all UI uses plain `Date` arithmetic and existing `tailwindcss`, `zustand`, `@phosphor-icons/react`.
