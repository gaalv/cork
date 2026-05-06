import { client } from "@/shared/ipc/client";

import type { BulkFrontmatterResult, BulkMoveResult, BulkPathResult, JsonRecord, VaultPath } from "@/shared/ipc/types";

export const bulkOps = {
  moveNote(notePath: string, destFolder: string): Promise<VaultPath> {
    return client.notes.move({ notePath, destFolder });
  },

  move(paths: string[], destFolder: string): Promise<BulkMoveResult> {
    return client.notes.bulkMove(paths, destFolder);
  },

  trash(paths: string[]): Promise<BulkPathResult> {
    return client.notes.bulkTrash(paths);
  },

  setFrontmatter(paths: string[], patch: JsonRecord): Promise<BulkFrontmatterResult> {
    return client.notes.bulkSetFrontmatter(paths, patch);
  },
};

export function summarizeBulkResult(result: BulkPathResult): string {
  if (result.failed.length === 0) {
    return `${result.ok.length} item${result.ok.length === 1 ? "" : "s"} updated`;
  }
  return `${result.ok.length} updated, ${result.failed.length} failed`;
}
