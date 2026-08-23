/**
 * Activity — the log behind the status bar bell.
 *
 * Replaces a "notifications" popover that held a hardcoded changelog and had no
 * data source: a bell that never rang. This shows what Cork actually did.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  Bell,
  CloudWarning,
  Sparkle,
  WarningCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";

import { useActivityStore, type ActivityKind } from "@/stores/activityStore";
import { formatRelativeDate } from "@/utils/triageHelpers";

const KIND_META: Record<ActivityKind, { icon: PhosphorIcon; className: string }> = {
  update: { icon: ArrowClockwise, className: "text-[var(--color-cork-accent)]" },
  sync: { icon: CloudWarning, className: "text-[var(--color-cork-danger)]" },
  conflict: { icon: WarningCircle, className: "text-[var(--color-cork-danger)]" },
  ai: { icon: Sparkle, className: "text-[var(--color-cork-muted)]" },
  index: { icon: ArrowClockwise, className: "text-[var(--color-cork-muted)]" },
};

export function ActivityPopover() {
  const entries = useActivityStore((s) => s.entries);
  const unreadErrors = useActivityStore((s) => s.unreadErrors);
  const markAllRead = useActivityStore((s) => s.markAllRead);
  const clear = useActivityStore((s) => s.clear);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Opening is the acknowledgement — no separate "mark as read" to hunt for.
    markAllRead();
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, markAllRead]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
        title="Activity"
        aria-label={unreadErrors > 0 ? `Activity — ${unreadErrors} needing attention` : "Activity"}
      >
        <Bell size={14} />
        {unreadErrors > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-cork-danger)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 w-[320px] overflow-hidden rounded-xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-[var(--shadow-lg)]">
          <div className="flex items-center justify-between border-b border-[var(--color-cork-border)] px-3.5 py-2">
            <h3 className="text-[12px] font-semibold text-[var(--color-cork-ink)]">Activity</h3>
            {entries.length > 0 && (
              <button
                onClick={clear}
                className="text-[11px] text-[var(--color-cork-subtle)] hover:text-[var(--color-cork-ink)]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {entries.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[12px] leading-relaxed text-[var(--color-cork-subtle)]">
                Nothing yet. Sync failures, update notices and anything that went wrong in the
                background will show up here.
              </p>
            ) : (
              entries.map((entry) => {
                const meta = KIND_META[entry.kind];
                const Icon = meta.icon;
                return (
                  <div
                    key={entry.id}
                    className="flex gap-2.5 border-b border-[var(--color-cork-border)] px-3.5 py-2.5 last:border-b-0"
                  >
                    <Icon size={13} className={`mt-0.5 shrink-0 ${meta.className}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-medium text-[var(--color-cork-ink)]">
                          {entry.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--color-cork-subtle)]">
                          {formatRelativeDate(entry.at)}
                        </span>
                      </div>
                      {entry.detail && (
                        <p className="mt-0.5 text-[11px] leading-snug break-words text-[var(--color-cork-muted)]">
                          {entry.detail}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
