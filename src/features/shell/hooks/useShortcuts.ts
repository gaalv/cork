import { useEffect } from "react";
import { tinykeys } from "tinykeys";

import { openOrCreateToday } from "@/features/daily/services/dailyService";
import { createAndOpenNote } from "@/features/note-ops/services/createAndOpenNote";
import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { cycleTheme } from "@/features/settings/runtime/themeRuntime";
import { useSettingsUiStore } from "@/features/settings/state/settingsUiStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

export function useShortcuts() {
  const openPalette = useShellStore((state) => state.openPalette);
  const back = useShellStore((state) => state.back);
  const forward = useShellStore((state) => state.forward);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);
  const lastDrawer = useShellStore((state) => state.lastDrawer);
  const openHelp = useShellStore((state) => state.openHelp);
  const openSettings = useSettingsUiStore((state) => state.openSettings);
  const openVault = useVaultStore((state) => state.openVault);
  const navigate = useShellStore((state) => state.navigate);

  useEffect(() => {
    const onPaletteShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener("keydown", onPaletteShortcut);

    const onQuestionMark = (event: KeyboardEvent) => {
      if (event.key !== "?" || isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      openHelp();
    };
    window.addEventListener("keydown", onQuestionMark);

    const unsubscribe = tinykeys(window, {
      "$mod+k": (event) => {
        event.preventDefault();
        openPalette();
      },
      "$mod+n": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        void createAndOpenNote();
      },
      "$mod+o": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        void openVault();
      },
      "$mod+,": (event) => {
        event.preventDefault();
        openSettings();
      },
      "$mod+Shift+l": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        cycleTheme();
      },
      "$mod+d": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        void openOrCreateToday();
      },
      "$mod+\\": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        toggleDrawer(lastDrawer);
      },
      "$mod+[": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        back();
      },
      "$mod+]": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        forward();
      },
      "$mod+Shift+g": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        navigate({ kind: "graph" });
      },
      "$mod+Shift+m": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        const store = useAppSettingsStore.getState();
        void store.setLayoutMode(store.settings.layout.mode === "focus" ? "triage" : "focus");
      },
      "(\\?)": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        openHelp();
      },
    });

    return () => {
      unsubscribe();
      window.removeEventListener("keydown", onPaletteShortcut);
      window.removeEventListener("keydown", onQuestionMark);
    };
  }, [back, forward, lastDrawer, navigate, openHelp, openPalette, openSettings, openVault, toggleDrawer]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}
