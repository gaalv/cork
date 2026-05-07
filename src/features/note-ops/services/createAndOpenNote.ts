import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { client } from "@/shared/ipc/client";

export const DEFAULT_INBOX_FOLDER = "";

export type CreateAndOpenNoteOptions = {
  folder?: string;
  title?: string;
};

export function defaultNewNoteFolder(): string {
  return useDrawersStore.getState().selectedFolder ?? DEFAULT_INBOX_FOLDER;
}

export async function createAndOpenNote(options: CreateAndOpenNoteOptions = {}): Promise<void> {
  const vaultPath = useVaultStore.getState().path;
  if (!vaultPath) {
    return;
  }

  const folder = options.folder ?? defaultNewNoteFolder();
  const created = await client.notes.create({
    folder,
    title: options.title,
  });
  await useVaultStore.getState().loadNotes();
  const createdNote = useVaultStore.getState().notes.find((note) => note.path === created.path);
  if (createdNote) {
    useShellStore.getState().navigate({ kind: "note", id: createdNote.id });
  }
}
