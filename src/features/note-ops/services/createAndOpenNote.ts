import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

export type CreateAndOpenNoteOptions = {
  folder?: string;
  title?: string;
};

export async function createAndOpenNote(options: CreateAndOpenNoteOptions = {}): Promise<void> {
  const vaultPath = useVaultStore.getState().path;
  if (!vaultPath) {
    return;
  }

  const created = await client.notes.create({
    folder: options.folder ?? "",
    title: options.title,
  });
  await useVaultStore.getState().loadNotes();
  const createdNote = useVaultStore.getState().notes.find((note) => note.path === created.path);
  if (createdNote) {
    useShellStore.getState().navigate({ kind: "note", id: createdNote.id });
  }
}
