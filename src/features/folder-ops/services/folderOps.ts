/**
 * Folder CRUD operations.
 *
 * @see F08 — Folder Management spec
 */

import { client } from "@/shared/ipc/client";

export const folderOps = {
  create: (input: { parent: string; name: string }) =>
    client.folders.create(input),
  rename: (input: { oldPath: string; newName: string }) =>
    client.folders.rename(input),
  move: (input: { srcPath: string; destParent: string }) =>
    client.folders.move(input),
  trash: (path: string) => client.folders.trash(path),
};

export function validateFolderName(name: string): string | null {
  if (!name.trim()) return "Name cannot be empty";
  if (/[/\\]/.test(name)) return "Name cannot contain slashes";
  if (/^\./.test(name)) return "Name cannot start with a dot";
  if (name.length > 255) return "Name is too long";
  return null;
}
