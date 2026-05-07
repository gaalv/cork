import { cn } from "@/shared/utils/cn";
import type { NoteSummary } from "../services/calendarService";

type DayCellProps = {
  date: Date;
  isToday: boolean;
  isCurrentMonth: boolean;
  isSelected: boolean;
  notes: NoteSummary[];
  onClick: () => void;
};

export function DayCell({ date, isToday, isCurrentMonth, isSelected, notes, onClick }: DayCellProps) {
  const hasNotes = notes.length > 0;

  return (
    <button
      type="button"
      aria-label={`${date.toDateString()}${hasNotes ? `, ${notes.length} note${notes.length > 1 ? "s" : ""}` : ""}`}
      aria-pressed={isSelected}
      onClick={onClick}
      className={cn(
        "relative flex h-10 w-full flex-col items-center justify-center rounded-lg text-sm transition focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none",
        isCurrentMonth
          ? "text-[var(--color-noxe-ink)] hover:bg-[var(--color-noxe-panel-2)]"
          : "text-[var(--color-noxe-muted)] opacity-40 hover:bg-[var(--color-noxe-panel-2)]",
        isToday && !isSelected && "font-bold ring-1 ring-[var(--color-noxe-primary)]",
        isSelected && "bg-[var(--color-noxe-primary)] font-bold text-[var(--color-noxe-primary-foreground)] hover:bg-[var(--color-noxe-primary)]",
      )}
    >
      <span>{date.getDate()}</span>
      {hasNotes && (
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 h-1 w-1 rounded-full",
            isSelected ? "bg-[var(--color-noxe-primary-foreground)]" : "bg-[var(--color-noxe-primary)]",
          )}
        />
      )}
    </button>
  );
}
