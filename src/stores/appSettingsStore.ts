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

import { client, CommandError } from "@/ipc/client";
import { setTypography } from "@/services/fontRuntime";
import type { AppSettings } from "@/ipc/types";

const DEFAULT_SETTINGS: AppSettings = {
  appearance: { density: "comfortable", theme: "system", uiFont: "system" },
  editor: {
    autoSaveDebounceMs: 500,
    previewDefault: false,
    lineWrap: true,
    showLineNumbers: false,
    fontSize: 15,
    lineHeight: 1.7,
    fontFamily: "system",
    codeFont: "system",
    tabSize: 2,
    livePreview: true,
    spellCheck: true,
  },
  vault: {},
  markdown: { callouts: true, footnotes: true, highlight: true },
  assets: { offlineMode: false },
  ai: {
    provider: "disabled",
    models: {
      claude: { small: "", standard: "", premium: "" },
      copilot: { small: "", standard: "", premium: "" },
      codex: { small: "", standard: "", premium: "" },
    },
  },
  layout: { mode: "triage", triageNavWidth: 220, triageListWidth: 300 },
  updates: { autoCheck: true },
};

type AppSettingsState = {
  settings: AppSettings;
  loaded: boolean;
  loadAppSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
};

let loadPromise: Promise<void> | null = null;
let saveQueue = Promise.resolve();
let settingsRevision = 0;

/** Push the typography slice of the settings onto the DOM + localStorage. */
function syncTypography(settings: AppSettings) {
  setTypography({
    uiFont: settings.appearance.uiFont,
    editorFont: settings.editor.fontFamily,
    codeFont: settings.editor.codeFont,
    fontSize: settings.editor.fontSize,
    lineHeight: settings.editor.lineHeight,
  });
}

function mergeSettings(base: AppSettings, partial: Partial<AppSettings>): AppSettings {
  const provider = partial.ai?.provider;
  const supportedProvider =
    provider === "claude" || provider === "copilot" || provider === "disabled"
      ? provider
      : base.ai.provider;

  return {
    appearance: { ...base.appearance, ...partial.appearance },
    editor: { ...base.editor, ...partial.editor },
    vault: { ...base.vault, ...partial.vault },
    markdown: { ...base.markdown, ...partial.markdown },
    assets: { ...base.assets, ...partial.assets },
    ai: {
      ...base.ai,
      ...partial.ai,
      provider: supportedProvider,
      // Deep-merge so a settings file written before per-tier models existed
      // still yields a complete shape.
      models: { ...base.ai.models, ...partial.ai?.models },
    },
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
  loaded: false,

  loadAppSettings: () => {
    if (get().loaded) return Promise.resolve();
    if (loadPromise) return loadPromise;

    loadPromise = client.settings
      .appLoad()
      .then((loaded) => {
        const merged = mergeSettings(DEFAULT_SETTINGS, loaded as Partial<AppSettings>);
        set({ settings: merged, loaded: true });
        syncTypography(merged);
      })
      .catch((error) => {
        if (error instanceof CommandError && error.kind === "Parse") {
          set({ settings: DEFAULT_SETTINGS, loaded: true });
          syncTypography(DEFAULT_SETTINGS);
          return;
        }
        throw error;
      })
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  },

  updateSettings: async (patch) => {
    await get().loadAppSettings();
    const revision = ++settingsRevision;
    const previous = get().settings;
    const merged = mergeSettings(get().settings, patch);
    set({ settings: merged });
    syncTypography(merged);

    const save = saveQueue.then(() => client.settings.appSave(merged));
    saveQueue = save.then(
      () => undefined,
      () => undefined,
    );
    try {
      await save;
    } catch (error) {
      await saveQueue;
      try {
        const persisted = await client.settings.appLoad();
        const restored = mergeSettings(DEFAULT_SETTINGS, persisted as Partial<AppSettings>);
        if (settingsRevision === revision) {
          set({ settings: restored, loaded: true });
          syncTypography(restored);
        }
      } catch {
        if (settingsRevision === revision) {
          set({ settings: previous, loaded: false });
          syncTypography(previous);
        }
      }
      throw error;
    }
  },
}));
