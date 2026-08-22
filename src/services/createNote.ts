/**
 * Create a new note and open it in the editor.
 */

import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { resolveNoteTarget } from "@/services/noteTarget";
import type { VaultPath } from "@/ipc/types";

export type CreateNoteOptions = {
  /** Overrides the sidebar context. See `resolveNoteTarget`. */
  folder?: string;
  /** Seed title; the backend falls back to "Untitled" when blank. */
  title?: string;
};

/**
 * Create a new note and open it for editing.
 *
 * The destination comes from `resolveNoteTarget`, so ⌘N, the NotesList button,
 * the command palette, the app menu and quick capture all agree on where a
 * note lands.
 */
export async function createNote(options: CreateNoteOptions = {}) {
  const target = resolveNoteTarget(options.folder);
  try {
    const result = await client.notes.create({
      folder: target.folder,
      ...(options.title ? { title: options.title } : {}),
    });
    const created = result as VaultPath;
    await useVaultStore.getState().loadNotes();
    const note = findNoteByPath(created.path);
    if (!note) {
      toast.error(`Created the note in ${target.label} but could not open it`);
      return;
    }
    useShellStore.setState({ forceEdit: true });
    useShellStore.getState().openNote(note.id);
  } catch (err) {
    toast.error(
      `Failed to create note in ${target.label}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Create a note from a template and open it in edit mode with the caret at
 * the template's {{cursor}} position (start of note when absent).
 * Destination follows the same rule as `createNote`.
 */
export async function createNoteFromTemplate(templatePath: string, folder?: string) {
  const target = resolveNoteTarget(folder);
  try {
    const result = await client.notes.createFromTemplate({ folder: target.folder, templatePath });
    await useVaultStore.getState().loadNotes();
    const note = findNoteByPath(result.path);
    if (note) {
      useEditorStore.getState().setPendingCursorOffset(result.cursorOffset);
      useShellStore.setState({ forceEdit: true });
      useShellStore.getState().openNote(note.id);
    }
  } catch (err) {
    toast.error(
      `Failed to create note from template: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Create a new (empty) template note in the templates folder and open it —
 * used by the TemplatePicker empty state and Settings → Templates.
 */
export async function createTemplateNote() {
  const settings = await client.settings.vaultLoad().catch(() => null);
  const folder = settings?.templatesFolder?.trim() || "Templates";
  await createNote({ folder });
}

/**
 * Match a freshly created absolute path against the loaded notes list.
 * Compares with endsWith in both directions to handle canonicalized vs
 * non-canonicalized absolute paths.
 */
export function findNoteByPath(path: string) {
  const notes = useVaultStore.getState().notes;
  const createdNorm = path.replace(/\\/g, "/");
  return notes.find((n) => {
    const notePath = (typeof n.path === "string" ? n.path : String(n.path)).replace(/\\/g, "/");
    return (
      notePath === createdNorm || notePath.endsWith(createdNorm) || createdNorm.endsWith(notePath)
    );
  });
}
