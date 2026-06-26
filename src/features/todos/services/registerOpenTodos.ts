/**
 * Todos runtime — listens for the tray/menu "open-todos" event.
 *
 * Routes to the todos view via shellStore navigation.
 */

import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useShellStore } from "@/features/shell/state/shellStore";

export async function installOpenTodosRuntime() {
  await listen("tray:open-todos", async () => {
    const win = getCurrentWindow();
    await win.show();
    await win.setFocus();

    useShellStore.getState().navigate({ kind: "home" });
  });
}
