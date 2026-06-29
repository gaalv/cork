/**
 * Bulk note operations — move and trash multiple notes at once.
 *
 * @see F08 — Folder Management spec
 */

import { client } from "@/ipc/client";

export const bulkOps = {
  move: (paths: string[], destFolder: string) => client.notes.bulkMove(paths, destFolder),
  trash: (paths: string[]) => client.notes.bulkTrash(paths),
  moveNote: (notePath: string, destFolder: string) => client.notes.move({ notePath, destFolder }),
};
