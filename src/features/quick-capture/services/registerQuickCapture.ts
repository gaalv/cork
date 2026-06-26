/**
 * Quick-capture runtime — listens for the tray/global-shortcut event
 * and creates a new note in the Inbox folder.
 *
 * @see F17 — Inbox & Quick Capture spec
 */

import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { client } from "@/shared/ipc/client";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { useShellStore } from "@/features/shell/state/shellStore";

export async function installQuickCaptureRuntime() {
  await listen("tray:quick-capture", async () => {
    // Show and focus the window
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();

    // Only create note if a vault is open
    const vaultPath = useVaultStore.getState().path;
    if (!vaultPath) return;

    try {
      const created = await client.notes.create({ folder: "Inbox", title: "" });
      await useVaultStore.getState().loadNotes();
      const note = useVaultStore.getState().notes.find((n) => created.path.endsWith(n.path));
      if (note) {
        useShellStore.getState().openNote(note.id);
      }
    } catch {
      // Vault may not support Inbox folder yet
    }
  });
}
