import { create } from "zustand";

type CalendarStore = {
  /** The first day of the currently displayed month. */
  viewMonth: Date;
  /** The currently selected day, or null if none selected. */
  selectedDate: Date | null;
  goToMonth: (year: number, month: number) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  /** Resets viewMonth to current month and selectedDate to today. */
  goToday: () => void;
  selectDate: (date: Date | null) => void;
};

function firstOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

export const useCalendarStore = create<CalendarStore>((set) => {
  const now = new Date();
  return {
    viewMonth: firstOfMonth(now.getFullYear(), now.getMonth()),
    selectedDate: null,

    goToMonth(year, month) {
      set({ viewMonth: firstOfMonth(year, month) });
    },

    goToPrevMonth() {
      set((state) => {
        const y = state.viewMonth.getFullYear();
        const m = state.viewMonth.getMonth();
        return { viewMonth: firstOfMonth(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1) };
      });
    },

    goToNextMonth() {
      set((state) => {
        const y = state.viewMonth.getFullYear();
        const m = state.viewMonth.getMonth();
        return { viewMonth: firstOfMonth(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1) };
      });
    },

    goToday() {
      const today = new Date();
      set({ viewMonth: firstOfMonth(today.getFullYear(), today.getMonth()), selectedDate: today });
    },

    selectDate(date) {
      set({ selectedDate: date });
    },
  };
});
