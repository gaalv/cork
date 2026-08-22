/**
 * Where a new note goes — the single source of truth.
 *
 * Every entry point (⌘N, the NotesList button, the command palette, the app
 * menu, tray quick capture, templates) resolves its destination here, so the
 * rule is stated once instead of being re-derived at each call site.
 *
 * The rule: a new note lands in whatever the sidebar is currently showing.
 * Inside a folder → that folder. Anywhere else (All, Starred, Archived, a tag,
 * a status) → the Inbox.
 *
 * "Inbox" is the vault root, not a folder named `Inbox`. That matches how the
 * sidebar already defines it (`!note.folder`) and keeps an unfiled note
 * genuinely unfiled — no surprise directory appears in the user's vault.
 *
 * @see F17 — Inbox & Quick Capture
 */

import { loadFilter } from "@/utils/triageHelpers";

/** Vault root. Empty string is what the backend joins onto the vault path. */
export const INBOX_FOLDER = "";

/** What the Inbox is called in the UI. */
export const INBOX_LABEL = "Inbox";

export type NoteTarget = {
  /** Vault-relative folder, `""` for the root. */
  folder: string;
  /** Human-readable destination, for toasts and confirmations. */
  label: string;
};

/**
 * Resolve the destination for a new note.
 *
 * @param explicitFolder Overrides the sidebar context. Pass `INBOX_FOLDER` to
 *   force the Inbox (quick capture), or a folder name for a targeted create.
 */
export function resolveNoteTarget(explicitFolder?: string): NoteTarget {
  if (explicitFolder !== undefined) {
    const folder = explicitFolder.trim();
    return { folder, label: folder || INBOX_LABEL };
  }

  const filter = loadFilter();
  if (filter.kind === "folder") {
    const folder = filter.id.trim();
    if (folder) return { folder, label: folder };
  }

  return { folder: INBOX_FOLDER, label: INBOX_LABEL };
}
