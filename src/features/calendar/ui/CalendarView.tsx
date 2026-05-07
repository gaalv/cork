import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useEffect } from "react";

import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { openOrCreateToday } from "@/features/daily/services/dailyService";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { useCalendarStore } from "../state/calendarStore";
import { aggregateNotesForMonth, buildMonthGrid, dateToISO, isDailyNoteForDate } from "../services/calendarService";
import { AgendaPanel } from "./AgendaPanel";
import { MonthGrid } from "./MonthGrid";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView() {
  const { viewMonth, selectedDate, goToPrevMonth, goToNextMonth, goToday, selectDate } = useCalendarStore();
  const navigate = useShellStore((state) => state.navigate);
  const drawer = useShellStore((state) => state.drawer);
  const notes = useVaultStore((state) => state.notes);
  const dailyPathPattern = useAppSettingsStore((state) => state.dailyPathPattern) ?? undefined;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  const grid = buildMonthGrid(year, month);
  const noteMap = aggregateNotesForMonth(notes, year, month, dailyPathPattern);

  // Escape: deselect or go home
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (drawer !== null) return;
      event.preventDefault();
      if (selectedDate !== null) {
        selectDate(null);
      } else {
        navigate({ kind: "home" });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawer, navigate, selectedDate, selectDate]);

  async function handleSelectDay(date: Date) {
    const iso = dateToISO(date);
    const dayNotes = noteMap.get(iso) ?? [];
    const dailyNote = dayNotes.find((n) => isDailyNoteForDate(n.path, date, dailyPathPattern));

    if (dailyNote) {
      navigate({ kind: "note", id: dailyNote.id });
      return;
    }
    selectDate(date);
  }

  async function handleCreateDailyNote() {
    if (!selectedDate) return;
    await openOrCreateToday(selectedDate, dailyPathPattern);
    selectDate(null);
  }

  function handleOpenNote(id: string) {
    navigate({ kind: "note", id });
  }

  const selectedISO = selectedDate ? dateToISO(selectedDate) : null;
  const selectedNotes = selectedISO ? (noteMap.get(selectedISO) ?? []) : [];
  const hasDailyNote = selectedDate
    ? selectedNotes.some((n) => isDailyNoteForDate(n.path, selectedDate, dailyPathPattern))
    : false;

  return (
    <main
      data-testid="calendar-view"
      className="flex h-full min-h-0 flex-1 overflow-hidden"
    >
      {/* Calendar pane */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[var(--color-noxe-ink)]">
            {MONTH_NAMES[month]} {year}
          </h1>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={goToPrevMonth}
              className="flex size-8 items-center justify-center rounded-lg text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
            >
              <CaretLeft size={16} />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded-lg px-3 py-1 text-sm text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={goToNextMonth}
              className="flex size-8 items-center justify-center rounded-lg text-[var(--color-noxe-muted)] hover:bg-[var(--color-noxe-panel-2)] hover:text-[var(--color-noxe-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-noxe-ring)] focus-visible:outline-none"
            >
              <CaretRight size={16} />
            </button>
          </div>
        </div>

        <MonthGrid
          grid={grid}
          noteMap={noteMap}
          viewMonth={viewMonth}
          selectedDate={selectedDate}
          onSelectDay={(date) => void handleSelectDay(date)}
        />
      </div>

      {/* Agenda panel */}
      {selectedDate !== null && (
        <AgendaPanel
          date={selectedDate}
          notes={selectedNotes}
          hasDailyNote={hasDailyNote}
          onOpenNote={handleOpenNote}
          onCreateDailyNote={() => void handleCreateDailyNote()}
          onClose={() => selectDate(null)}
        />
      )}
    </main>
  );
}
