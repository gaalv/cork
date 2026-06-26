/**
 * Native menu event dispatcher — listens to Tauri menu-item events
 * and routes them into shellStore / commands.
 *
 * @see F13 — Settings, Search & App Menu spec
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { useShellStore } from "@/features/shell/state/shellStore";
import { cycleTheme } from "@/features/settings/runtime/themeRuntime";
import { createNote } from "@/features/shell/services/createNote";

let unlisten: UnlistenFn | null = null;

const MENU_HANDLERS: Record<string, () => void> = {
  "menu:new-note": () => {
    void createNote();
  },
  "menu:open-vault": () => {
    // Triggers vault picker
  },
  "menu:settings": () => {
    useShellStore.getState().setSettingsOpen(true);
  },
  "menu:toggle-theme": () => {
    cycleTheme();
  },
  "menu:command-palette": () => {
    useShellStore.getState().setPaletteOpen(true);
  },
  "menu:help": () => {
    useShellStore.getState().setHelpOpen(true);
  },
};

export function startMenuActionListener() {
  if (unlisten) return;

  void listen<string>("menu-action", (event) => {
    const handler = MENU_HANDLERS[event.payload];
    if (handler) handler();
  }).then((fn) => {
    unlisten = fn;
  });
}

export async function stopMenuActionListener() {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
}
