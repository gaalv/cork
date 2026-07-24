/**
 * Daily notes — resolve today's note path, create it if missing, open it.
 *
 * @see F43 — Daily Notes
 * @see AD-052 — daily notes stay flat: one top-level folder + `YYYY-MM-DD.md`
 */

import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { findNoteByPath } from "./createNote";
import type { VaultPath } from "@/ipc/types";

const DEFAULT_DAILY_PATTERN = "Daily/YYYY-MM-DD.md";

/**
 * Open the daily note for `date` (default today), creating it first when
 * missing (idempotent). Uses the vault's `dailyTemplatePath` template when it
 * points to an existing template; otherwise creates a plain note with a
 * `# YYYY-MM-DD` heading.
 */
export async function openDailyNote(date: Date = new Date()) {
  try {
    const settings = await client.settings.vaultLoad().catch(() => null);
    const { folder, fileName } = resolveDailyPath(settings?.dailyPathPattern, date);
    const relPath = folder ? `${folder}/${fileName}` : fileName;
    const title = fileName.replace(/\.md$/i, "");

    // DAY-04 — same-day reuse: open the existing note, never duplicate.
    await useVaultStore.getState().loadNotes();
    const existing = findNoteByRelPath(relPath);
    if (existing) {
      useShellStore.getState().openNote(existing.id);
      return;
    }

    const templatePath = await resolveDailyTemplate(settings?.dailyTemplatePath);
    if (templatePath) {
      const result = await client.notes.createFromTemplate({ folder, templatePath, title });
      await openCreatedNote(result.path, result.cursorOffset);
      return;
    }

    const created = (await client.notes.create({ folder, title })) as VaultPath;
    // `notes.create` writes an empty body — fill in the daily heading.
    const file = await client.notes.read(created.path);
    await client.notes.save({
      path: file.path,
      frontmatter: file.frontmatter,
      body: `# ${title}\n`,
      expectedMtime: file.mtime,
    });
    await openCreatedNote(created.path, null);
  } catch (err) {
    toast.error(`Failed to open daily note: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function openCreatedNote(path: string, cursorOffset: number | null) {
  await useVaultStore.getState().loadNotes();
  const note = findNoteByPath(path);
  if (!note) return;
  if (cursorOffset !== null) {
    useEditorStore.getState().setPendingCursorOffset(cursorOffset);
  }
  useShellStore.setState({ forceEdit: true });
  useShellStore.getState().openNote(note.id);
}

/**
 * Expand the daily pattern for today's local date and constrain it per
 * AD-052: a single top-level folder plus a flat filename — nested date
 * segments from legacy patterns are dropped.
 */
function resolveDailyPath(
  pattern: string | undefined,
  date: Date,
): { folder: string; fileName: string } {
  const raw = pattern?.trim() || DEFAULT_DAILY_PATTERN;
  const segments = expandDateTokens(raw, date)
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return resolveDailyPath(DEFAULT_DAILY_PATTERN, date);
  }
  const last = segments[segments.length - 1];
  const fileName = last.toLowerCase().endsWith(".md") ? last : `${last}.md`;
  return { folder: segments.length > 1 ? segments[0] : "", fileName };
}

/** Replace YYYY / MM / DD tokens with the target date's zero-padded local date. */
function expandDateTokens(pattern: string, date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return pattern.replaceAll("YYYY", yyyy).replaceAll("MM", mm).replaceAll("DD", dd);
}

/**
 * Resolve `dailyTemplatePath` against the vault's known templates. Accepts an
 * absolute path, a vault-relative path, or a bare template name; returns the
 * absolute template path, or null when unset or no longer existing.
 */
async function resolveDailyTemplate(setting?: string): Promise<string | null> {
  const wanted = setting?.trim().replace(/\\/g, "/");
  if (!wanted) return null;
  const templates = await client.templates.list().catch(() => []);
  const entry = templates.find((t) => {
    const abs = t.path.replace(/\\/g, "/");
    const rel = t.relPath.replace(/\\/g, "/");
    return abs === wanted || rel === wanted || abs.endsWith(`/${wanted}`) || t.name === wanted;
  });
  return entry?.path ?? null;
}

/** Match a vault-relative path against the loaded notes (exact suffix match). */
function findNoteByRelPath(relPath: string) {
  const notes = useVaultStore.getState().notes;
  return notes.find((n) => {
    const notePath = n.path.replace(/\\/g, "/");
    return notePath === relPath || notePath.endsWith(`/${relPath}`);
  });
}
