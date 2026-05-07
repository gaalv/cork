import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";

import { useSyncStore } from "@/features/sync/state/syncStore";

export const SYNC_NOW_EVENT = "sync:now";

let unlisten: UnlistenFn | null = null;

export async function installSyncNowRuntime(): Promise<void> {
  if (unlisten) return;
  try {
    unlisten = await listen(SYNC_NOW_EVENT, () => {
      void (async () => {
        try {
          await useSyncStore.getState().syncNow();
          toast.success("Sync started");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Sync failed");
        }
      })();
    });
  } catch {
    unlisten = null;
  }
}

export function uninstallSyncNowRuntime(): void {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}
