import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { createAndOpenNote, DEFAULT_INBOX_FOLDER } from "@/features/note-ops/services/createAndOpenNote";

export const QUICK_CAPTURE_EVENT = "quick-capture:new";

let unlisten: UnlistenFn | null = null;

export async function installQuickCaptureRuntime(): Promise<void> {
  if (unlisten) {
    return;
  }
  try {
    unlisten = await listen(QUICK_CAPTURE_EVENT, () => {
      void createAndOpenNote({ folder: DEFAULT_INBOX_FOLDER });
    });
  } catch {
    unlisten = null;
  }
}

export function uninstallQuickCaptureRuntime(): void {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}
