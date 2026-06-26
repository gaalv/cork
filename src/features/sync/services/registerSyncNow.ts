/**
 * Sync-now runtime — listens for the menu/palette "sync-now" event
 * and triggers a remote sync via IPC.
 *
 * @see F26 — GitHub Sync spec
 */

import { listen } from "@tauri-apps/api/event";

import { client } from "@/shared/ipc/client";

export async function installSyncNowRuntime() {
  await listen("menu:sync-now", async () => {
    try {
      await client.vcs.remoteSyncNow();
    } catch {
      // Sync may not be configured — silently ignore
    }
  });
}
