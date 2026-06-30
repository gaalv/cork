/**
 * NotificationsPopover — dropdown from the bell icon in the StatusBar.
 *
 * Shows "What's New" changelog entries with unread badge tracking.
 * Read state is persisted in localStorage so it survives restarts.
 */

import { useEffect, useRef, useState } from "react";
import { Bell, Megaphone, Sparkle, Wrench } from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

type ChangelogEntry = {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  kind: "feature" | "improvement" | "fix";
};

const KIND_META: Record<ChangelogEntry["kind"], { icon: PhosphorIcon; color: string }> = {
  feature: { icon: Sparkle, color: "text-amber-500" },
  improvement: { icon: Megaphone, color: "text-blue-500" },
  fix: { icon: Wrench, color: "text-green-500" },
};

/**
 * Changelog entries — newest first.
 * Add entries here when shipping new versions.
 */
const CHANGELOG: ChangelogEntry[] = [
  {
    id: "0.1.0-initial",
    version: "0.1.0",
    date: "2026-06-30",
    title: "Welcome to Cork!",
    description:
      "Local-first Markdown notes with CodeMirror 6 editor, wikilinks, GitHub sync, AI skills, and a command-driven triage layout.",
    kind: "feature",
  },
];

const STORAGE_KEY = "cork.notifications.lastSeenId";

function getLastSeenId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setLastSeenId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable
  }
}

function countUnread(): number {
  const lastSeen = getLastSeenId();
  if (!lastSeen) return CHANGELOG.length;
  const idx = CHANGELOG.findIndex((e) => e.id === lastSeen);
  return idx < 0 ? CHANGELOG.length : idx;
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(() => countUnread());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Mark all as read when opened
    if (CHANGELOG.length > 0) {
      setLastSeenId(CHANGELOG[0].id);
      setUnread(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded p-1 hover:bg-[var(--color-cork-panel-2)] hover:text-[var(--color-cork-ink)]"
        title="Notifications"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 w-[320px] overflow-hidden rounded-xl border border-[var(--color-cork-border)] bg-[var(--color-cork-panel)] shadow-xl">
          {/* Header */}
          <div className="border-b border-[var(--color-cork-border)] px-4 py-2.5">
            <h3 className="text-[12px] font-semibold text-[var(--color-cork-ink)]">What's New</h3>
          </div>

          {/* Entries */}
          <div className="max-h-[300px] overflow-y-auto">
            {CHANGELOG.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-[var(--color-cork-subtle)]">
                No updates yet.
              </div>
            ) : (
              CHANGELOG.map((entry) => {
                const meta = KIND_META[entry.kind];
                const KindIcon = meta.icon;
                return (
                  <div
                    key={entry.id}
                    className="border-b border-[var(--color-cork-border)] px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <KindIcon size={14} weight="fill" className={meta.color} />
                      <span className="flex-1 text-[12px] font-medium text-[var(--color-cork-ink)]">
                        {entry.title}
                      </span>
                      <span className="text-[10px] text-[var(--color-cork-subtle)]">
                        v{entry.version}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-cork-muted)]">
                      {entry.description}
                    </p>
                    <span className="mt-1 inline-block text-[10px] text-[var(--color-cork-subtle)]">
                      {entry.date}
                    </span>
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
