import { client } from "@/shared/ipc/client";
import type { CommitEntry, VcsStatus } from "@/shared/ipc/types";

export const vcsClient = {
  status: (): Promise<VcsStatus> => client.vcs.status(),
  history: (notePath: string, limit = 30): Promise<CommitEntry[]> =>
    client.vcs.history(notePath, limit),
  restore: (notePath: string, sha: string): Promise<void> =>
    client.vcs.restore(notePath, sha),
};
