/**
 * Global app settings store — reads/writes via IPC to the Tauri backend.
 *
 * Settings apply immediately without restart. The store merges partial
 * backend responses over hardcoded defaults so the UI always has a
 * complete AppSettings shape.
 *
 * @see F13 — Settings, Search & App Menu spec
 */

import { create } from "zustand";

import { client } from "@/ipc/client";
import type { AppSettings } from "@/ipc/types";

const DEFAULT_SETTINGS: AppSettings = {
  appearance: { density: "comfortable", theme: "system" },
  editor: {
    autoSaveDebounceMs: 500,
    previewDefault: false,
    lineWrap: true,
    showLineNumbers: false,
    fontFamily: "monospace",
    fontSize: 14,
    tabSize: 2,
    showInvisibles: false,
    vimMode: false,
  },
  vault: {},
  markdown: { callouts: true, footnotes: true, highlight: true },
  assets: { offlineMode: false },
  ai: { provider: "disabled" },
  layout: { mode: "triage", triageNavWidth: 220, triageListWidth: 300 },
  updates: { autoCheck: true },
};

type AppSettingsState = {
  settings: AppSettings;
  loadVaultSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

function mergeSettings(base: AppSettings, partial: Partial<AppSettings>): AppSettings {
  return {
    appearance: { ...base.appearance, ...partial.appearance },
    editor: { ...base.editor, ...partial.editor },
    vault: { ...base.vault, ...partial.vault },
    markdown: { ...base.markdown, ...partial.markdown },
    assets: { ...base.assets, ...partial.assets },
    ai: { ...base.ai, ...partial.ai },
    layout: {
      mode: "triage" as const,
      triageNavWidth: 220,
      triageListWidth: 300,
      ...base.layout,
      ...partial.layout,
    },
    updates: { autoCheck: true, ...base.updates, ...partial.updates },
  };
}

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,

  loadVaultSettings: async () => {
    try {
      const loaded = await client.settings.appLoad();
      set({ settings: mergeSettings(DEFAULT_SETTINGS, loaded as Partial<AppSettings>) });
    } catch {
      // keep defaults on error
    }
  },

  updateSettings: async (patch) => {
    const merged = mergeSettings(get().settings, patch);
    set({ settings: merged });
    try {
      await client.settings.appSave(merged);
    } catch {
      // persisting failed — UI still reflects the change
    }
  },
}));
