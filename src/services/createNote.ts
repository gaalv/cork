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
    // Find the note by matching the path suffix returned from the backend
    const notes = useVaultStore.getState().notes;
    const note = notes.find((n) => created.path.endsWith(n.path));
    if (note) {
      useShellStore.getState().openNote(note.id);
    }
  } catch (err) {
    toast.error(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
  }
}
