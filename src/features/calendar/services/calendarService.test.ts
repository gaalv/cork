import { describe, expect, it } from "vitest";

import {
  aggregateNotesForMonth,
  buildMonthGrid,
  dateToISO,
  isDailyNoteForDate,
  type NoteSummary,
} from "./calendarService";

describe("buildMonthGrid", () => {
  it("returns exactly 6 rows of 7 cells each", () => {
    const grid = buildMonthGrid(2026, 5); // June 2026
    expect(grid).toHaveLength(6);
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });

  it("first cell is on or before the 1st of the month", () => {
    const grid = buildMonthGrid(2026, 5); // June 2026 (month index 5)
    const firstCell = grid[0]![0]!;
    const firstOfMonth = new Date(2026, 5, 1);
    expect(firstCell.getTime()).toBeLessThanOrEqual(firstOfMonth.getTime());
  });

  it("last cell is on or after the last day of the month", () => {
    const grid = buildMonthGrid(2026, 5); // June 2026 — 30 days
    const lastCell = grid[5]![6]!;
    const lastOfMonth = new Date(2026, 5, 30);
    expect(lastCell.getTime()).toBeGreaterThanOrEqual(lastOfMonth.getTime());
  });

  it("grid covers months where the 1st falls on Sunday (no leading padding)", () => {
    // March 2026: 1st is a Sunday → no leading days from February
    const grid = buildMonthGrid(2026, 2);
    expect(grid[0]![0]!.getDate()).toBe(1);
    expect(grid[0]![0]!.getMonth()).toBe(2);
  });

  it("grid covers months where the 1st falls on Saturday (6 leading days)", () => {
    // August 2026: 1st is a Saturday → first cell is Monday July 27
    const grid = buildMonthGrid(2026, 7);
    const firstCell = grid[0]![0]!;
    expect(firstCell.getMonth()).toBe(6); // July (0-indexed)
    expect(firstCell.getDate()).toBe(26); // July 26 (Sunday before Aug 1)
  });

  it("cells are in ascending order", () => {
    const grid = buildMonthGrid(2026, 0); // January 2026
    let prev: Date | null = null;
    for (const week of grid) {
      for (const cell of week) {
        if (prev !== null) {
          expect(cell.getTime()).toBeGreaterThan(prev.getTime());
        }
        prev = cell;
      }
    }
  });
});

describe("dateToISO", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(dateToISO(new Date(2026, 5, 4))).toBe("2026-06-04");
  });

  it("zero-pads single-digit month and day", () => {
    expect(dateToISO(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("handles end-of-year", () => {
    expect(dateToISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("isDailyNoteForDate", () => {
  it("matches default pattern", () => {
    const date = new Date(2026, 5, 4); // 2026-06-04
    expect(isDailyNoteForDate("/vault/Daily/2026/06/2026-06-04.md", date)).toBe(true);
  });

  it("rejects wrong date", () => {
    const date = new Date(2026, 5, 4);
    expect(isDailyNoteForDate("/vault/Daily/2026/06/2026-06-03.md", date)).toBe(false);
  });

  it("handles custom pattern", () => {
    const date = new Date(2026, 5, 4);
    expect(isDailyNoteForDate("/vault/notes/daily/2026-06-04.md", date, "notes/daily/YYYY-MM-DD.md")).toBe(true);
  });

  it("matches path without leading vault prefix", () => {
    const date = new Date(2026, 5, 4);
    expect(isDailyNoteForDate("Daily/2026/06/2026-06-04.md", date)).toBe(true);
  });

  it("does not match a partial suffix", () => {
    const date = new Date(2026, 5, 14);
    expect(isDailyNoteForDate("/vault/Daily/2026/06/2026-06-04.md", date)).toBe(false);
  });
});

describe("aggregateNotesForMonth", () => {
  const notes: NoteSummary[] = [
    { id: "d1", path: "/vault/Daily/2026/06/2026-06-04.md", title: "2026-06-04" },
    { id: "d2", path: "/vault/Daily/2026/06/2026-06-10.md", title: "2026-06-10" },
    { id: "e1", path: "/vault/Work/Standup.md", title: "Standup", eventDate: "2026-06-10" },
    { id: "e2", path: "/vault/Projects/Review.md", title: "Review", eventDate: "2026-06-15" },
    { id: "x1", path: "/vault/Daily/2025/12/2025-12-31.md", title: "2025-12-31" }, // different month
  ];

  it("finds daily note for matching day", () => {
    const map = aggregateNotesForMonth(notes, 2026, 5); // June 2026
    expect(map.has("2026-06-04")).toBe(true);
    expect(map.get("2026-06-04")![0]!.id).toBe("d1");
  });

  it("combines daily note and event note on same day", () => {
    const map = aggregateNotesForMonth(notes, 2026, 5);
    const june10 = map.get("2026-06-10");
    expect(june10).toBeDefined();
    expect(june10!.map((n) => n.id).sort()).toEqual(["d2", "e1"].sort());
  });

  it("includes event-only note", () => {
    const map = aggregateNotesForMonth(notes, 2026, 5);
    expect(map.has("2026-06-15")).toBe(true);
    expect(map.get("2026-06-15")![0]!.id).toBe("e2");
  });

  it("excludes notes from other months", () => {
    const map = aggregateNotesForMonth(notes, 2026, 5);
    expect(map.has("2025-12-31")).toBe(false);
  });

  it("returns empty map when no notes match", () => {
    const map = aggregateNotesForMonth([], 2026, 5);
    expect(map.size).toBe(0);
  });

  it("uses custom daily path pattern", () => {
    const customNotes: NoteSummary[] = [{ id: "c1", path: "/vault/journal/2026/2026-06-04.md", title: "day" }];
    const map = aggregateNotesForMonth(customNotes, 2026, 5, "journal/YYYY/YYYY-MM-DD.md");
    expect(map.has("2026-06-04")).toBe(true);
  });
});
