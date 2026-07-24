import type { NoteStatus } from "@/ipc/types";

export const NOTE_STATUSES: readonly NoteStatus[] = ["active", "on-hold", "done"] as const;

type StatusMeta = { label: string; dotClass: string; chipClass: string };

export const NOTE_STATUS_META: Record<NoteStatus, StatusMeta> = {
  active: {
    label: "Active",
    dotClass: "bg-emerald-500",
    chipClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "on-hold": {
    label: "On hold",
    dotClass: "bg-amber-500",
    chipClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  done: {
    label: "Done",
    dotClass: "bg-[var(--color-cork-subtle)]",
    chipClass: "bg-[var(--color-cork-panel-2)] text-[var(--color-cork-muted)]",
  },
};

/**
 * Narrow a raw frontmatter `status` value to a known NoteStatus.
 * Unknown values (e.g. edited externally) are treated as unset —
 * no badge, no crash (STAT-07).
 */
export function narrowNoteStatus(value: unknown): NoteStatus | undefined {
  return NOTE_STATUSES.find((s) => s === value);
}
