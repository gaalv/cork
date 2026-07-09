import type { NoteStatus } from "@/ipc/types";

export const NOTE_STATUSES: readonly NoteStatus[] = ["active", "on-hold", "done"] as const;

/**
 * Narrow a raw frontmatter `status` value to a known NoteStatus.
 * Unknown values (e.g. edited externally) are treated as unset —
 * no badge, no crash (STAT-07).
 */
export function narrowNoteStatus(value: unknown): NoteStatus | undefined {
  return NOTE_STATUSES.find((s) => s === value);
}
