import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

export async function moveOpenNote(noteId: string, destFolder: string): Promise<boolean> {
  const note = useVaultStore.getState().notes.find((entry) => entry.id === noteId);
  if (!note) {
    return false;
  }
  const target = destFolder.trim();
  if (target === note.folder) {
    return true;
  }

  try {
    await client.notes.move({ notePath: note.path, destFolder: target });
    await useVaultStore.getState().loadNotes();
    useShellStore.getState().navigate({ kind: "note", id: noteId });
    useShellStore.getState().pushToast({
      title: "Note moved",
      description: target.length > 0 ? `Moved to ${target}` : "Moved to root",
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    useShellStore.getState().pushToast({
      title: "Move failed",
      description: message,
    });
    return false;
  }
}
