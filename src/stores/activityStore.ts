/**
 * Activity — what Cork did while you were not looking.
 *
 * Toasts are the right surface for something that just happened, and the wrong
 * one for something you missed: they vanish. This keeps a short, bounded log of
 * events worth being able to look up afterwards — a sync that failed, an AI
 * call that errored, a note that changed on disk under you.
 *
 * Deliberately not a feed of everything. An entry earns its place only if the
 * user might reasonably go looking for it later.
 */

import { create } from "zustand";

export type ActivityKind = "update" | "sync" | "conflict" | "ai" | "index";

/**
 * Only failures raise the badge.
 *
 * If routine success lit the dot too, the dot would mostly mean "nothing to
 * do" and you would stop looking — which is exactly when it needs to work.
 * Everything worth looking up is still recorded; the badge just means
 * "something wants you".
 */
export type ActivitySeverity = "error" | "info";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  severity: ActivitySeverity;
  title: string;
  detail?: string;
  /** Epoch ms. */
  at: number;
  read: boolean;
};

const STORAGE_KEY = "cork-activity";
/** Enough to answer "what happened earlier", not an audit log. */
const MAX_ENTRIES = 30;

function load(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function persist(entries: ActivityEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // best-effort
  }
}

function countUnreadErrors(entries: ActivityEntry[]): number {
  return entries.filter((e) => !e.read && e.severity === "error").length;
}

type ActivityState = {
  entries: ActivityEntry[];
  /** Unread failures — what the badge counts. */
  unreadErrors: number;
  push: (entry: Omit<ActivityEntry, "id" | "at" | "read">) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const useActivityStore = create<ActivityState>((set, get) => ({
  entries: load(),
  unreadErrors: load().filter((e) => !e.read && e.severity === "error").length,

  push: (entry) => {
    const entries = get().entries;
    // Collapse a repeat of the newest entry instead of stacking identical rows
    // — a sync retrying in a loop should not bury everything else.
    const newest = entries[0];
    if (newest && newest.kind === entry.kind && newest.title === entry.title) {
      const updated = [{ ...newest, at: Date.now(), read: false }, ...entries.slice(1)];
      persist(updated);
      set({ entries: updated, unreadErrors: countUnreadErrors(updated) });
      return;
    }

    const next: ActivityEntry[] = [
      { ...entry, id: crypto.randomUUID(), at: Date.now(), read: false },
      ...entries,
    ].slice(0, MAX_ENTRIES);

    persist(next);
    set({ entries: next, unreadErrors: countUnreadErrors(next) });
  },

  markAllRead: () => {
    const next = get().entries.map((e) => ({ ...e, read: true }));
    persist(next);
    set({ entries: next, unreadErrors: 0 });
  },

  clear: () => {
    persist([]);
    set({ entries: [], unreadErrors: 0 });
  },
}));

/** Record a failure — raises the badge. */
export function recordFailure(kind: ActivityKind, title: string, detail?: string): void {
  useActivityStore.getState().push({ kind, severity: "error", title, detail });
}

/** Record something worth looking up later, without demanding attention. */
export function recordActivity(kind: ActivityKind, title: string, detail?: string): void {
  useActivityStore.getState().push({ kind, severity: "info", title, detail });
}
