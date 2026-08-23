/**
 * Native menu event dispatcher.
 *
 * The Rust side emits `menu:action` carrying the raw menu id. This listened for
 * `menu-action` and looked up ids under a `menu:` prefix, so neither the event
 * name nor the payload matched and every custom menu item was inert — the ones
 * that seemed to work did so through their keyboard shortcut, which
 * useShortcuts binds independently.
 *
 * @see F13 — Settings, Search & App Menu spec
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { openSearchPanel } from "@codemirror/search";
import { toast } from "sonner";

import { client } from "@/ipc/client";
import { getEditorView } from "@/cm/viewRef";
import { useShellStore } from "@/stores/shellStore";
import { useSettingsUiStore } from "@/stores/settingsUiStore";
import { useVaultStore } from "@/stores/vaultStore";
import { cycleTheme } from "@/services/themeRuntime";
import { createNote } from "@/services/createNote";
import { insertDailyBrief } from "@/services/dailyBrief";
import { structureMeetingNote } from "@/services/meetingNote";
import { copyNoteAsMarkdown, exportNoteAsHtml, exportNoteAsPdf } from "@/services/exportNote";

let unlisten: UnlistenFn | null = null;

async function importFolder() {
  try {
    const res = await client.vault.importFolder();
    await useVaultStore.getState().loadNotes();
    toast.success(
      `Imported ${res.imported} file${res.imported === 1 ? "" : "s"}` +
        (res.skipped ? ` · skipped ${res.skipped}` : ""),
    );
  } catch {
    toast.error("Could not import that folder");
  }
}

/** Keyed by the raw menu id, exactly as Rust emits it. */
const MENU_HANDLERS: Record<string, () => void> = {
  "new-note": () => void createNote(),
  "new-from-template": () => useShellStore.getState().setTemplatePickerMode("create"),
  "insert-template": () => useShellStore.getState().setTemplatePickerMode("insert"),
  "open-vault": () => void useVaultStore.getState().openVault(),
  "import-folder": () => void importFolder(),
  "close-vault": () => void useVaultStore.getState().closeVault(),
  "export-html": () => void exportNoteAsHtml(),
  "export-pdf": () => void exportNoteAsPdf(),
  "copy-markdown": () => void copyNoteAsMarkdown(),

  "open-settings": () => useSettingsUiStore.getState().openSettings(),
  "toggle-theme": () => cycleTheme(),
  "toggle-folders": () => useShellStore.getState().toggleSidebar(),
  "command-palette": () => useShellStore.getState().setPaletteOpen(true),
  replace: () => useShellStore.getState().setReplaceOpen(true),
  find: () => {
    // The editor owns search; focusing it lets the CodeMirror keymap take over.
    const view = getEditorView();
    if (view) {
      view.focus();
      openSearchPanel(view);
    } else {
      toast.message("Open a note to search inside it");
    }
  },
  "reveal-vault": () => {
    const path = useVaultStore.getState().path;
    if (path) void revealItemInDir(path);
  },
  documentation: () => void openUrl("https://github.com/gaalv/cork#readme"),
  about: () => useShellStore.getState().setHelpOpen(true),

  "ai-ask": () => useShellStore.getState().setAskVaultOpen(true),
  "ai-triage": () => useShellStore.getState().setTriageOpen(true),
  "ai-generate": () => useShellStore.getState().setGenerateModalOpen(true),
  "ai-daily-brief": () => void insertDailyBrief(),
  "ai-meeting-note": () => void structureMeetingNote(),

  "view:keyboard-shortcuts": () => useShellStore.getState().setHelpOpen(true),
  "help:keyboard-shortcuts": () => useShellStore.getState().setHelpOpen(true),
  help: () => useShellStore.getState().setHelpOpen(true),
};

export function startMenuActionListener() {
  if (unlisten) return;

  void listen<string>("menu:action", (event) => {
    MENU_HANDLERS[event.payload]?.();
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
