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
    const notes = useVaultStore.getState().notes;
    // Match by checking if either path ends with the other (handles
    // canonicalized vs non-canonicalized absolute paths).
    const createdNorm = created.path.replace(/\\/g, "/");
    const note = notes.find((n) => {
      const notePath = (typeof n.path === "string" ? n.path : String(n.path)).replace(/\\/g, "/");
      return (
        notePath === createdNorm || notePath.endsWith(createdNorm) || createdNorm.endsWith(notePath)
      );
    });
    if (note) {
      useShellStore.getState().openNote(note.id);
    }
  } catch (err) {
    toast.error(`Failed to create note: ${err instanceof Error ? err.message : String(err)}`);
  }
}
