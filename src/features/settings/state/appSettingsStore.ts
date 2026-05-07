import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import { DEFAULT_APP_SETTINGS } from "./settingsTypes";

import type { AppSettings, AiProvider } from "./settingsTypes";
import type { VaultSettings } from "@/shared/ipc/types";

type SettingsClient = {
  settings?: {
    appLoad: () => Promise<AppSettings>;
    appSave: (settings: AppSettings) => Promise<AppSettings>;
    vaultLoad: () => Promise<VaultSettings>;
    vaultSave: (settings: VaultSettings) => Promise<VaultSettings>;
  };
};

const STORAGE_KEY = "noxe.appSettings";

export type AppSettingsStore = {
  settings: AppSettings;
  autoRewriteLinksOnRename: boolean;
  dailyPathPattern?: string;
  attachmentsFolder?: string;
  offlineMode: boolean;
  vaultSettings: VaultSettings | null;
  load: () => Promise<void>;
  setSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setAutoRewriteLinksOnRename: (enabled: boolean) => void;
  setOfflineMode: (enabled: boolean) => void;
  loadVaultSettings: () => Promise<void>;
  applyVaultSettings: (settings: VaultSettings) => void;
  reset: () => void;
};

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  settings: loadPersisted(),
  autoRewriteLinksOnRename: true,
  dailyPathPattern: undefined,
  attachmentsFolder: undefined,
  offlineMode: loadPersisted().assets.offlineMode,
  vaultSettings: null,

  async load() {
    const loaded = await loadNativeSettings();
    set({ settings: loaded, offlineMode: loaded.assets.offlineMode });
    persist(loaded);
  },

  async setSettings(settings) {
    set({ settings, offlineMode: settings.assets.offlineMode });
    persist(settings);
    await saveNativeSettings(settings);
  },

  async updateSettings(patch) {
    const next = mergeAppSettings(get().settings, patch);
    await get().setSettings(next);
  },

  setAutoRewriteLinksOnRename(enabled) {
    set({ autoRewriteLinksOnRename: enabled });
    void (client as SettingsClient).settings?.vaultSave({ ...get().vaultSettings, autoRewriteLinksOnRename: enabled }).catch(
      () => undefined,
    );
  },

  setOfflineMode(enabled) {
    const next = { ...get().settings, assets: { ...get().settings.assets, offlineMode: enabled } };
    set({ settings: next, offlineMode: enabled });
    persist(next);
    void saveNativeSettings(next);
  },

  async loadVaultSettings() {
    const settingsClient = (client as SettingsClient).settings;
    const settings = settingsClient ? await settingsClient.vaultLoad().catch(() => client.vault.settings()) : await client.vault.settings();
    get().applyVaultSettings(settings);
  },

  applyVaultSettings(settings) {
    const next: Partial<AppSettingsStore> = {
      vaultSettings: settings,
      dailyPathPattern: settings.dailyPathPattern,
      attachmentsFolder: settings.attachmentsFolder,
      autoRewriteLinksOnRename: settings.autoRewriteLinksOnRename ?? true,
    };
    if (typeof settings.offlineMode === "boolean") {
      next.offlineMode = settings.offlineMode;
    }
    set(next);
  },

  reset() {
    set({
      settings: DEFAULT_APP_SETTINGS,
      autoRewriteLinksOnRename: true,
      dailyPathPattern: undefined,
      attachmentsFolder: undefined,
      offlineMode: DEFAULT_APP_SETTINGS.assets.offlineMode,
      vaultSettings: null,
    });
    persist(DEFAULT_APP_SETTINGS);
  },
}));

function mergeAppSettings(current: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    appearance: { ...current.appearance, ...patch.appearance },
    editor: { ...current.editor, ...patch.editor },
    vault: { ...current.vault, ...patch.vault },
    markdown: { ...current.markdown, ...patch.markdown },
    assets: { ...current.assets, ...patch.assets },
    ai: { ...current.ai, ...patch.ai },
  };
}

async function loadNativeSettings(): Promise<AppSettings> {
  try {
    const settingsClient = (client as SettingsClient).settings;
    if (!settingsClient) {
      return loadPersisted();
    }
    return normalizeAppSettings(await settingsClient.appLoad());
  } catch {
    return loadPersisted();
  }
}

async function saveNativeSettings(settings: AppSettings): Promise<void> {
  try {
    await (client as SettingsClient).settings?.appSave(settings);
  } catch {
    // Web preview and tests do not have native IPC.
  }
}

function loadPersisted(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_APP_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_APP_SETTINGS;
    }
    return normalizeAppSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

function persist(settings: AppSettings) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return DEFAULT_APP_SETTINGS;
  }
  const appearance = isRecord(value.appearance) ? value.appearance : {};
  const editor = isRecord(value.editor) ? value.editor : {};
  const vault = isRecord(value.vault) ? value.vault : {};
  const markdown = isRecord(value.markdown) ? value.markdown : {};
  const assets = isRecord(value.assets) ? value.assets : {};
  return {
    appearance: {
      density: appearance.density === "compact" ? "compact" : DEFAULT_APP_SETTINGS.appearance.density,
      theme: normalizeTheme(appearance.theme),
    },
    editor: {
      autoSaveDebounceMs: numberOr(editor.autoSaveDebounceMs, DEFAULT_APP_SETTINGS.editor.autoSaveDebounceMs),
      previewDefault: booleanOr(editor.previewDefault, DEFAULT_APP_SETTINGS.editor.previewDefault),
      lineWrap: booleanOr(editor.lineWrap, DEFAULT_APP_SETTINGS.editor.lineWrap),
      showLineNumbers: booleanOr(editor.showLineNumbers, DEFAULT_APP_SETTINGS.editor.showLineNumbers),
      fontFamily: stringOr(editor.fontFamily, DEFAULT_APP_SETTINGS.editor.fontFamily),
      fontSize: numberOr(editor.fontSize, DEFAULT_APP_SETTINGS.editor.fontSize),
      tabSize: numberOr(editor.tabSize, DEFAULT_APP_SETTINGS.editor.tabSize),
      showInvisibles: booleanOr(editor.showInvisibles, DEFAULT_APP_SETTINGS.editor.showInvisibles),
    },
    vault: { recentLimit: numberOr(vault.recentLimit, DEFAULT_APP_SETTINGS.vault.recentLimit) },
    markdown: {
      callouts: booleanOr(markdown.callouts, DEFAULT_APP_SETTINGS.markdown.callouts),
      footnotes: booleanOr(markdown.footnotes, DEFAULT_APP_SETTINGS.markdown.footnotes),
      highlight: booleanOr(markdown.highlight, DEFAULT_APP_SETTINGS.markdown.highlight),
    },
    assets: { offlineMode: booleanOr(assets.offlineMode, DEFAULT_APP_SETTINGS.assets.offlineMode) },
    ai: { provider: normalizeAiProvider(isRecord(value.ai) ? (value.ai as Record<string, unknown>).provider : undefined) },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function normalizeTheme(value: unknown): "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system" ? value : DEFAULT_APP_SETTINGS.appearance.theme;
}

function normalizeAiProvider(value: unknown): AiProvider {
  return value === "claude" || value === "copilot" ? value : "disabled";
}
