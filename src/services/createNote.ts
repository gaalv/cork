/**
 * Create a new note and open it in the editor.
 */

import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useEditorStore } from "@/stores/editorStore";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import { loadFilter } from "@/utils/triageHelpers";
import type { VaultPath } from "@/ipc/types";

/**
 * Create a new note and open it. When `folder` is omitted the note lands in
 * the sidebar's active folder (Inbox when not inside one); pass an explicit
 * folder to override (e.g. quick capture always targets Inbox).
 */
export async function createNote(folder?: string) {
  try {
    const target = folder ?? activeFolderTarget();
    const result = await client.notes.create({ folder: target });
    const created = result as VaultPath;
    await useVaultStore.getState().loadNotes();
    const note = findNoteByPath(created.path);
    if (note) {
      useShellStore.setState({ forceEdit: true });
      useShellStore.getState().openNote(note.id);
    }
  } catch (err) {
    toast.error(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Create a note from a template and open it in edit mode with the caret at
 * the template's {{cursor}} position (start of note when absent).
 * Targets the sidebar's active folder, falling back to Inbox.
 */
export async function createNoteFromTemplate(templatePath: string, folder?: string) {
  try {
    const target = folder ?? activeFolderTarget();
    const result = await client.notes.createFromTemplate({ folder: target, templatePath });
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

function activeFolderTarget(): string {
  const filter = loadFilter();
  return filter.kind === "folder" ? filter.id : "inbox";
}

/**
 * Create a new (empty) template note in the templates folder and open it —
 * used by the TemplatePicker empty state and Settings → Templates.
 */
export async function createTemplateNote() {
  const settings = await client.settings.vaultLoad().catch(() => null);
  const folder = settings?.templatesFolder?.trim() || "Templates";
  await createNote(folder);
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
