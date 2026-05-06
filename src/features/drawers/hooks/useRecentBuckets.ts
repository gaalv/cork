import type { NoteEntry } from "@/shared/ipc/types";

export type RecentBucket = {
  label: string;
  notes: NoteEntry[];
};

export function bucketRecentNotes(notes: NoteEntry[], now = new Date()): RecentBucket[] {
  const startToday = startOfDay(now).getTime();
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  const startThisWeek = startToday - 6 * 24 * 60 * 60 * 1000;
  const buckets: RecentBucket[] = [
    { label: "Today", notes: [] },
    { label: "Yesterday", notes: [] },
    { label: "This week", notes: [] },
    { label: "Earlier", notes: [] },
  ];

  for (const note of notes) {
    const mtime = normalizeMtime(note.mtime);
    if (mtime >= startToday) {
      buckets[0]!.notes.push(note);
    } else if (mtime >= startYesterday) {
      buckets[1]!.notes.push(note);
    } else if (mtime >= startThisWeek) {
      buckets[2]!.notes.push(note);
    } else {
      buckets[3]!.notes.push(note);
    }
  }

  return buckets.filter((bucket) => bucket.notes.length > 0);
}

function normalizeMtime(mtime: number): number {
  return mtime < 10_000_000_000 ? mtime * 1000 : mtime;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
