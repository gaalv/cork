/**
 * Create a new note and open it in the editor.
 */

import { toast } from "sonner";

import { client } from "@/ipc/client";
import { useShellStore } from "@/stores/shellStore";
import { useVaultStore } from "@/stores/vaultStore";
import type { VaultPath } from "@/ipc/types";

export async function createNote(folder = "") {
  try {
    const result = await client.notes.create({ folder });
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
