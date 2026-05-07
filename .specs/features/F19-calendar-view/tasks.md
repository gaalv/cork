# F19 — Tasks

## Dependency map

```
T1 (spec docs)
  └─► T2 (calendarService + tests)
        └─► T3 (calendarStore)
              └─► T4 (UI components)
                    └─► T5 (shell integration)
                          └─► T6 (component tests)
                                └─► T7 (DEFERRED.md update)
```

---

## T1 — Write spec / design / tasks

**Files:** `.specs/features/F19-calendar-view/{spec,design,tasks}.md`
**Commit prefix:** `spec(F19)`
**Done when:** All three docs exist and are coherent with the implementation scope.

---

## T2 — calendarService: pure functions + unit tests

**Files:**
- `src/features/calendar/services/calendarService.ts`
- `src/features/calendar/services/calendarService.test.ts`

**Exports:**
```ts
export type NoteSummary = { id: string; path: string; title: string; eventDate?: string };

export function buildMonthGrid(year: number, month: number): Date[][]
// Returns 6 rows × 7 cols; fills leading/trailing from adjacent months.
// month is 0-indexed (JS Date convention).

export function dateToISO(date: Date): string
// "YYYY-MM-DD" from a Date.

export function isDailyNoteForDate(notePath: string, date: Date, pattern?: string): boolean
// Returns true when notePath ends with "/<computedDailyPath>" (uses computeDailyPath).

export function aggregateNotesForMonth(
  notes: NoteSummary[],
  year: number,
  month: number,
  dailyPathPattern?: string,
): Map<string, NoteSummary[]>
// Keys: ISO dates with ≥1 note. Values: daily + event notes for that day.
```

**Tests (vitest):**
- `buildMonthGrid` produces 6 rows × 7 cols; first cell ≤ 1st of month; last cell ≥ last day of month.
- `dateToISO` formats correctly; zero-pads month/day.
- `isDailyNoteForDate` matches default pattern; rejects wrong date; handles custom pattern.
- `aggregateNotesForMonth` finds daily notes by path; groups event notes by eventDate.

**Commit prefix:** `feat(F19)` / `test(F19)`
**Done when:** `pnpm test` is green; all listed exports exist and are type-correct.

---

## T3 — calendarStore: Zustand store

**Files:**
- `src/features/calendar/state/calendarStore.ts`

**State shape:**
```ts
viewMonth: Date  // 1st of displayed month
selectedDate: Date | null
```

**Actions:**
```ts
goToMonth(year: number, month: number): void
goToPrevMonth(): void
goToNextMonth(): void
goToday(): void        // sets viewMonth to now's month; selectedDate to today
selectDate(date: Date | null): void
```

**Commit prefix:** `feat(F19)`
**Done when:** Store is importable; `goToday` sets `viewMonth` to first of current month and `selectedDate` to today; `goToPrevMonth`/`goToNextMonth` correctly underflow/overflow month boundaries.

---

## T4 — Calendar UI components

**Files:**
- `src/features/calendar/ui/CalendarView.tsx`
- `src/features/calendar/ui/MonthGrid.tsx`
- `src/features/calendar/ui/DayCell.tsx`
- `src/features/calendar/ui/AgendaPanel.tsx`

### CalendarView
- Reads `viewMonth`, `selectedDate`, actions from `useCalendarStore`.
- Reads `notes` from `useVaultStore`.
- Reads `dailyPathPattern` from `useAppSettingsStore`.
- Calls `aggregateNotesForMonth` to build note map.
- Renders `<MonthGrid>` and `<AgendaPanel>`.
- Handles Escape: if `selectedDate` → deselect; else → `navigate({ kind: "home" })`.

### MonthGrid
- Accepts: `grid: Date[][]`, `noteMap: Map<string, NoteSummary[]>`, `viewMonth: Date`, `selectedDate: Date | null`, `onSelectDay: (date: Date) => void`.
- Renders 7-column header (Sun–Sat) + 6 rows of `DayCell`.

### DayCell
- Accepts: `date: Date`, `isToday: boolean`, `isCurrentMonth: boolean`, `isSelected: boolean`, `notes: NoteSummary[]`, `onClick: () => void`.
- Shows day number.
- Shows a dot indicator when `notes.length > 0`.
- Applies highlighted styles for today, selected, and out-of-month states.

### AgendaPanel
- Accepts: `date: Date`, `notes: NoteSummary[]`, `hasDailyNote: boolean`, `onOpenNote: (id: string) => void`, `onCreateDailyNote: () => void`, `onClose: () => void`.
- Shows formatted date heading.
- Lists notes as clickable rows.
- Shows "Create daily note for YYYY-MM-DD" button when `!hasDailyNote`.
- Shows "No notes for this day." when `notes.length === 0 && hasDailyNote` is N/A and none exist.

**Commit prefix:** `feat(F19)`
**Done when:** `pnpm typecheck` passes; components render without errors in isolation (verified in T6 tests).

---

## T5 — Shell integration

**Files:**
- `src/features/shell/state/shellStore.ts` — extend `ShellView`, update `isShellView`
- `src/features/shell/ui/ViewRouter.tsx` — add calendar branch
- `src/features/shell/ui/Rail.tsx` — add Calendar nav button

### shellStore changes
```ts
// Before
export type ShellView = { kind: "home" } | { kind: "note"; id: string };

// After
export type ShellView = { kind: "home" } | { kind: "note"; id: string } | { kind: "calendar" };
```
`isShellView` guard adds: `if (value.kind === "calendar") return true;`

### ViewRouter changes
```tsx
if (view.kind === "calendar") {
  return <CalendarView />;
}
```

### Rail changes
Add a nav button for Calendar above the drawerButtons map:
```tsx
<RailButton
  icon={<CalendarBlank size={18} />}
  label="Calendar"
  active={view.kind === "calendar" && drawer === null}
  onClick={() => { navigate({ kind: "calendar" }); }}
/>
```

**Commit prefix:** `feat(F19)`
**Done when:** `pnpm typecheck && pnpm test` green; sidebar shows Calendar icon; clicking it renders CalendarView.

---

## T6 — Component and integration tests

**Files:**
- `src/features/calendar/ui/CalendarView.test.tsx`
- `src/features/calendar/ui/MonthGrid.test.tsx`
- `src/features/calendar/ui/DayCell.test.tsx`

**Tests:**
- `DayCell`: renders day number; shows dot when notes > 0; applies today/selected styles.
- `MonthGrid`: renders 42 cells; day-of-week headers present.
- `CalendarView`: "Today" button resets month; prev/next buttons change month header; clicking a day with a note calls navigate; clicking a day without a note shows agenda panel with create CTA.

**Commit prefix:** `test(F19)`
**Done when:** `pnpm test` green; all new tests pass alongside existing 229.

---

## T7 — Update DEFERRED.md

**File:** `.specs/DEFERRED.md`

Replace D1 section to note:
- v0 (month grid + daily note indicators) and v1 (agenda panel) implemented in F19.
- Still deferred: Google Calendar OAuth/sync, week view, day view, drag-to-create, recurring events.

**Commit prefix:** `chore(F19)`
**Done when:** DEFERRED.md accurately reflects remaining deferred scope.
