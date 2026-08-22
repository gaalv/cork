/**
 * Quick-capture runtime — listens for the tray / global-shortcut event and
 * drops the user straight into a fresh, editable note.
 *
 * Capture has to be instant, so this never asks a question: it always targets
 * the Inbox (vault root) regardless of what the sidebar is showing, and stamps
 * the title so the note is findable later without being renamed first.
 *
 * @see F17 — Inbox & Quick Capture spec
 */

import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { toast } from "sonner";

import { useVaultStore } from "@/stores/vaultStore";
import { createNote } from "@/services/createNote";
import { INBOX_FOLDER } from "@/services/noteTarget";

/** `Quick capture 2026-08-21 17.45` — filename-safe (no colons or slashes). */
function quickCaptureTitle(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const time = `${p(now.getHours())}.${p(now.getMinutes())}`;
  return `Quick capture ${date} ${time}`;
}

export async function installQuickCaptureRuntime() {
  await listen("tray:quick-capture", async () => {
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();

    if (!useVaultStore.getState().path) {
      toast.error("Open a vault before capturing");
      return;
    }

    // Always the Inbox — capture must not depend on where the sidebar happens
    // to be pointing. createNote opens it in edit mode with the caret ready.
    await createNote({ folder: INBOX_FOLDER, title: quickCaptureTitle() });
  });
}
