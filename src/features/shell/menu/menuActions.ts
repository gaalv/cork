import { listen } from "@tauri-apps/api/event";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

import { openOrCreateToday } from "@/features/daily/services/dailyService";
import { useIndexStore } from "@/features/index/state/indexStore";
import { cycleTheme } from "@/features/settings/runtime/themeRuntime";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { switchVault } from "@/features/vault-switcher/services/switchVault";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import type { UnlistenFn } from "@tauri-apps/api/event";

let unlisten: Promise<UnlistenFn> | null = null;

function hasTauriInternals(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function startMenuActionListener(): void {
  if (!hasTauriInternals()) {
    return;
  }
  unlisten ??= listen<string>("menu:action", (event) => {
    void dispatchMenuAction(event.payload);
  });
}

export async function stopMenuActionListener(): Promise<void> {
  const stop = await unlisten;
  unlisten = null;
  stop?.();
}

export async function dispatchMenuAction(action: string): Promise<void> {
  if (action.startsWith("open-recent-vault:")) {
    await switchVault({ path: action.slice("open-recent-vault:".length) });
    return;
  }

  switch (action) {
    case "new-note":
      useShellStore.getState().navigate({ kind: "note", id: "new" });
      return;
    case "open-vault":
      await useVaultStore.getState().openVault();
      return;
    case "open-settings":
      useSettingsUiStore.getState().openSettings();
      return;
    case "toggle-theme":
      cycleTheme();
      return;
    case "reveal-vault": {
      const path = useVaultStore.getState().path;
      if (path) {
        await openPath(path);
      }
      return;
    }
    case "command-palette":
      useShellStore.getState().openPalette();
      return;
    case "keyboard-shortcuts":
      useShellStore.getState().openHelp();
      return;
    case "toggle-folders":
      useShellStore.getState().toggleDrawer("folders");
      return;
    case "open-daily":
      await openOrCreateToday();
      return;
    case "rebuild-index":
      await useIndexStore.getState().rebuild();
      return;
    case "find":
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF", metaKey: true, bubbles: true }));
      return;
    case "replace":
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF", metaKey: true, shiftKey: true, bubbles: true }));
      return;
    case "documentation":
      await openUrl("https://github.com/");
      return;
    case "about":
      useSettingsUiStore.getState().openSettings("about");
      return;
    default:
      console.warn(`Unhandled menu action: ${action}`);
  }
}
