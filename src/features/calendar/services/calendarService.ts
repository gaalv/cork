import { computeDailyPath, DEFAULT_DAILY_PATH_PATTERN } from "@/features/daily/services/dailyService";

export type NoteSummary = {
  id: string;
  path: string;
  title: string;
  /** ISO date (YYYY-MM-DD) from frontmatter `event` field, if pre-loaded. */
  eventDate?: string;
};

/** Returns a 6-row × 7-column grid of Date objects covering the given month. */
export function buildMonthGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month, 1 - startDow);

  const grid: Date[][] = [];
  const cursor = new Date(gridStart);
  for (let row = 0; row < 6; row++) {
    const week: Date[] = [];
    for (let col = 0; col < 7; col++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(week);
  }
  return grid;
}

/** Returns an ISO date string "YYYY-MM-DD" for a given Date. */
export function dateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Returns true when `notePath` corresponds to the daily note for `date`
 * using the given path pattern (defaults to `DEFAULT_DAILY_PATH_PATTERN`).
 */
export function isDailyNoteForDate(notePath: string, date: Date, pattern = DEFAULT_DAILY_PATH_PATTERN): boolean {
  const relativePath = computeDailyPath(date, pattern).replaceAll("\\", "/");
  const normalizedNote = notePath.replaceAll("\\", "/");
  return normalizedNote.endsWith(`/${relativePath}`) || normalizedNote === relativePath;
}

/**
 * Aggregates notes by ISO date for a given month.
 *
 * A note is included for a day if:
 *  - Its path matches the daily note for that day (via `isDailyNoteForDate`), or
 *  - Its `eventDate` field equals the ISO date for that day.
 *
 * Returns a Map from ISO date string to notes array; only dates with ≥1 note
 * are present as keys.
 */
export function aggregateNotesForMonth(
  notes: NoteSummary[],
  year: number,
  month: number,
  dailyPathPattern = DEFAULT_DAILY_PATH_PATTERN,
): Map<string, NoteSummary[]> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result = new Map<string, NoteSummary[]>();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const iso = dateToISO(date);
    const dayNotes: NoteSummary[] = [];

    for (const note of notes) {
      if (isDailyNoteForDate(note.path, date, dailyPathPattern)) {
        dayNotes.push(note);
      } else if (note.eventDate === iso) {
        dayNotes.push(note);
      }
    }

    if (dayNotes.length > 0) {
      result.set(iso, dayNotes);
    }
  }

  return result;
}
