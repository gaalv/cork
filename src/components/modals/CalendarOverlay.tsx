/**
 * CalendarOverlay — month grid over the vault, opened from the status bar.
 *
 * Day markers derive client-side from the loaded notes: a dot when a daily
 * note exists for the date, plus an activity heat from the count of notes
 * authored (ctime) that day. Clicking a day opens/creates that day's daily
 * note AND filters the NotesList to that date.
 *
 * Lazy-loaded (React.lazy in Shell) — no new IPC, no Rust.
 *
 * @see F47 — Calendar spec
 */

import { useMemo, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight, X } from "@phosphor-icons/react";

import { openDailyNote } from "@/services/dailyNote";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { cn } from "@/utils/cn";
import { localDateKey } from "@/utils/triageHelpers";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type DayStat = { count: number; hasDaily: boolean };

/** Monday-first weekday index (0 = Mon … 6 = Sun) for a Date. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function CalendarOverlay() {
  const notes = useVaultStore((s) => s.notes);
  const close = useShellStore((s) => s.setCalendarOpen);
  const requestFilter = useShellStore((s) => s.requestFilter);

  const today = new Date();
  const todayKey = localDateKey(today);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  // date key → { count, hasDaily }, rebuilt only when the notes list changes.
  const stats = useMemo(() => {
    const map = new Map<string, DayStat>();
    for (const n of notes) {
      const key = localDateKey(n.ctime);
      const entry = map.get(key) ?? { count: 0, hasDaily: false };
      entry.count += 1;
      // A daily note is one named after its own date (Daily/YYYY-MM-DD.md and
      // custom patterns both end in the date filename).
      const file = n.path.replace(/\\/g, "/").split("/").pop() ?? "";
      if (file.replace(/\.md$/i, "") === key.slice(0, 10) || file.includes(key)) {
        entry.hasDaily = true;
      }
      map.set(key, entry);
    }
    return map;
  }, [notes]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const { count } of stats.values()) if (count > max) max = count;
    return max;
  }, [stats]);

  // Grid: leading blanks (Mon-first) + each day of the month.
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const lead = mondayIndex(first);
    const out: (number | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) out.push(day);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  async function onDayClick(day: number) {
    const date = new Date(view.year, view.month, day);
    const key = localDateKey(date);
    close(false);
    requestFilter({ kind: "date", date: key });
    await openDailyNote(date);
  }

  /** 0–4 heat bucket for a day's note count. */
  function heat(count: number): number {
    if (count === 0 || maxCount === 0) return 0;
    return Math.min(4, Math.ceil((count / maxCount) * 4));
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-[var(--color-cork-ink)]/30 pt-[12vh]"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] overflow-hidden rounded-2xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarBlank size={16} className="text-[var(--color-cork-muted)]" />
            <h2 className="text-[14px] font-semibold">
              {MONTHS[view.month]} {view.year}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftMonth(-1)}
              className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              title="Previous month"
            >
              <CaretLeft size={14} />
            </button>
            <button
              onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
              className="rounded px-2 py-1 text-[11px] text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              title="Jump to current month"
            >
              Today
            </button>
            <button
              onClick={() => shiftMonth(1)}
              className="rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              title="Next month"
            >
              <CaretRight size={14} />
            </button>
            <button
              onClick={() => close(false)}
              className="ml-1 rounded p-1 text-[var(--color-cork-muted)] hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-3">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-cork-subtle)]"
              >
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} />;
              const key = localDateKey(new Date(view.year, view.month, day));
              const stat = stats.get(key);
              const h = stat ? heat(stat.count) : 0;
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  onClick={() => void onDayClick(day)}
                  title={stat ? `${stat.count} note${stat.count === 1 ? "" : "s"}` : "No notes"}
                  className={cn(
                    "relative flex h-9 flex-col items-center justify-center rounded-md text-[12px] transition",
                    h === 0 && "hover:bg-[var(--color-cork-panel-2)]",
                    h === 1 &&
                      "bg-[var(--color-cork-accent)]/10 hover:bg-[var(--color-cork-accent)]/20",
                    h === 2 &&
                      "bg-[var(--color-cork-accent)]/20 hover:bg-[var(--color-cork-accent)]/30",
                    h === 3 &&
                      "bg-[var(--color-cork-accent)]/35 hover:bg-[var(--color-cork-accent)]/45",
                    h === 4 &&
                      "bg-[var(--color-cork-accent)]/55 hover:bg-[var(--color-cork-accent)]/65",
                    isToday && "ring-1 ring-[var(--color-cork-accent)]",
                  )}
                >
                  <span
                    className={cn(
                      "leading-none",
                      isToday
                        ? "font-semibold text-[var(--color-cork-accent)]"
                        : "text-[var(--color-cork-ink)]",
                    )}
                  >
                    {day}
                  </span>
                  {stat?.hasDaily && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--color-cork-accent)]" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[10px] text-[var(--color-cork-subtle)]">
            Click a day to open its daily note and see that day&apos;s notes
          </p>
        </div>
      </div>
    </div>
  );
}
