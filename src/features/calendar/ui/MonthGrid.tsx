import { dateToISO } from "../services/calendarService";
import type { NoteSummary } from "../services/calendarService";
import { DayCell } from "./DayCell";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type MonthGridProps = {
  grid: Date[][];
  noteMap: Map<string, NoteSummary[]>;
  viewMonth: Date;
  selectedDate: Date | null;
  onSelectDay: (date: Date) => void;
};

export function MonthGrid({ grid, noteMap, viewMonth, selectedDate, onSelectDay }: MonthGridProps) {
  const today = new Date();
  const todayISO = dateToISO(today);
  const selectedISO = selectedDate ? dateToISO(selectedDate) : null;

  return (
    <div className="w-full" role="grid" aria-label="Month calendar">
      {/* Day-of-week header */}
      <div className="mb-1 grid grid-cols-7" role="row">
        {DOW_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            aria-label={label}
            className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--color-noxe-muted)]"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar rows */}
      {grid.map((week, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-7 gap-y-0.5" role="row">
          {week.map((date) => {
            const iso = dateToISO(date);
            return (
              <DayCell
                key={iso}
                date={date}
                isToday={iso === todayISO}
                isCurrentMonth={date.getMonth() === viewMonth.getMonth() && date.getFullYear() === viewMonth.getFullYear()}
                isSelected={iso === selectedISO}
                notes={noteMap.get(iso) ?? []}
                onClick={() => onSelectDay(date)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
