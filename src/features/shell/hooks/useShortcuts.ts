import { useEffect } from "react";
import { tinykeys } from "tinykeys";

import { openOrCreateToday } from "@/features/daily/services/dailyService";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

export function useShortcuts() {
  const openPalette = useShellStore((state) => state.openPalette);
  const navigate = useShellStore((state) => state.navigate);
  const back = useShellStore((state) => state.back);
  const forward = useShellStore((state) => state.forward);
  const toggleDrawer = useShellStore((state) => state.toggleDrawer);
  const lastDrawer = useShellStore((state) => state.lastDrawer);
  const openHelp = useShellStore((state) => state.openHelp);
  const openVault = useVaultStore((state) => state.openVault);

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
        navigate({ kind: "note", id: "new" });
      },
      "$mod+o": (event) => {
        if (isEditableTarget(event.target)) {
          return;
        }
        event.preventDefault();
        void openVault();
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
  }, [back, forward, lastDrawer, navigate, openHelp, openPalette, openVault, toggleDrawer]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}
