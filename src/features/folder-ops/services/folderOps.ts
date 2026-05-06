import { client } from "@/shared/ipc/client";

import type { FolderCreateInput, FolderMoveInput, FolderPath, FolderRenameInput } from "@/shared/ipc/types";

export const folderOps = {
  create(input: FolderCreateInput): Promise<FolderPath> {
    return client.folders.create(input);
  },

  rename(input: FolderRenameInput): Promise<FolderPath> {
    return client.folders.rename(input);
  },

  move(input: FolderMoveInput): Promise<FolderPath> {
    return client.folders.move(input);
  },

  trash(path: string): Promise<void> {
    return client.folders.trash(path);
  },
};

export function validateFolderName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "Folder name is required";
  }
  if (trimmed === "." || trimmed === ".." || trimmed.startsWith(".")) {
    return "Hidden and dot folders are not shown in Noxe";
  }
  if (/[\\/:*?"<>|]/.test(trimmed)) {
    return "Folder name cannot contain path separators or reserved characters";
  }
  return null;
}
