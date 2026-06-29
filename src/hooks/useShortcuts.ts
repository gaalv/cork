/**
 * Global keyboard shortcuts — wired via tinykeys.
 *
 * @see F13 — Settings (⌘,)
 * @see F15 — Theme toggle (⌘⇧L)
 */

import { useEffect } from "react";
import { tinykeys } from "tinykeys";

import { useShellStore } from "@/stores/shellStore";
import { useEditorStore } from "@/stores/editorStore";
import { cycleTheme } from "@/services/themeRuntime";
import { createNote } from "@/services/createNote";

export function useShortcuts() {
  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      // ⌘K — Command palette
      "$mod+KeyK": (event) => {
        event.preventDefault();
        useShellStore.getState().setPaletteOpen(true);
      },
      // ⌘, — Settings
      "$mod+Comma": (event) => {
        event.preventDefault();
        useShellStore.getState().setSettingsOpen(true);
      },
      // ⌘N — New note
      "$mod+KeyN": (event) => {
        event.preventDefault();
        void createNote();
      },
      // ⌘S — Save note
      "$mod+KeyS": (event) => {
        event.preventDefault();
        void useEditorStore.getState().forceSave();
      },
      // ⌘. — Toggle inspector
      "$mod+Period": (event) => {
        event.preventDefault();
        useShellStore.getState().toggleInspector();
      },
      // ⌘⇧L — Cycle theme
      "$mod+Shift+KeyL": (event) => {
        event.preventDefault();
        cycleTheme();
      },
      // Escape — Close topmost overlay
      Escape: () => {
        const shell = useShellStore.getState();
        if (shell.paletteOpen) {
          shell.setPaletteOpen(false);
        } else if (shell.settingsOpen) {
          shell.setSettingsOpen(false);
        } else if (shell.helpOpen) {
          shell.setHelpOpen(false);
        } else if (shell.generateModalOpen) {
          shell.setGenerateModalOpen(false);
        } else if (shell.drawer) {
          shell.setDrawer(null);
        }
      },
    });

    return unsubscribe;
  }, []);
}
