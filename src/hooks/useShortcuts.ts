/**
 * Global keyboard shortcuts — wired via tinykeys.
 *
 * @see F13 — Settings (⌘,)
 * @see F15 — Theme toggle (⌘⇧L)
 */

import { useEffect } from "react";
import { tinykeys } from "tinykeys";

import { useShellStore } from "@/stores/shellStore";
import { useSettingsUiStore } from "@/stores/settingsUiStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { getEditorView } from "@/cm/viewRef";
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
        useSettingsUiStore.getState().openSettings();
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
      // Escape — Close topmost overlay (but let vim handle it when editor is focused)
      Escape: (event) => {
        // When vim mode is on and the editor is focused, let CM6 vim handle
        // Escape (e.g. INSERT→NORMAL). Only intercept when an overlay is open.
        const vimOn = useAppSettingsStore.getState().settings.editor.vimMode;
        const editorFocused = getEditorView()?.hasFocus;

        const shell = useShellStore.getState();
        const settingsOpen = useSettingsUiStore.getState().open;
        const hasOverlay =
          shell.paletteOpen || settingsOpen || shell.helpOpen || shell.generateModalOpen;

        if (vimOn && editorFocused && !hasOverlay) return;

        event.preventDefault();
        if (shell.paletteOpen) {
          shell.setPaletteOpen(false);
        } else if (settingsOpen) {
          useSettingsUiStore.getState().closeSettings();
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
