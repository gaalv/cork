import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import type { VaultSettings } from "@/shared/ipc/types";

type PersistedAppSettings = {
  autoRewriteLinksOnRename?: boolean;
  offlineMode?: boolean;
};

type AppSettingsStore = {
  autoRewriteLinksOnRename: boolean;
  dailyPathPattern?: string;
  attachmentsFolder?: string;
  offlineMode: boolean;
  vaultSettings: VaultSettings | null;
  setAutoRewriteLinksOnRename: (enabled: boolean) => void;
  setOfflineMode: (enabled: boolean) => void;
  loadVaultSettings: () => Promise<void>;
  applyVaultSettings: (settings: VaultSettings) => void;
  reset: () => void;
};

const STORAGE_KEY = "noxe.appSettings";
const DEFAULT_AUTO_REWRITE = true;
const DEFAULT_OFFLINE_MODE = false;

const persisted = loadPersisted();

export const useAppSettingsStore = create<AppSettingsStore>((set, get) => ({
  autoRewriteLinksOnRename: persisted.autoRewriteLinksOnRename ?? DEFAULT_AUTO_REWRITE,
  dailyPathPattern: undefined,
  attachmentsFolder: undefined,
  offlineMode: persisted.offlineMode ?? DEFAULT_OFFLINE_MODE,
  vaultSettings: null,

  setAutoRewriteLinksOnRename(enabled) {
    set({ autoRewriteLinksOnRename: enabled });
    persist({ ...persistedFromState(get()), autoRewriteLinksOnRename: enabled });
  },

  setOfflineMode(enabled) {
    set({ offlineMode: enabled });
    persist({ ...persistedFromState(get()), offlineMode: enabled });
  },

  async loadVaultSettings() {
    const settings = await client.vault.settings();
    get().applyVaultSettings(settings);
  },

  applyVaultSettings(settings) {
    const globalSettings = loadPersisted();
    set({
      vaultSettings: settings,
      dailyPathPattern: settings.dailyPathPattern,
      attachmentsFolder: settings.attachmentsFolder,
      offlineMode: settings.offlineMode ?? globalSettings.offlineMode ?? DEFAULT_OFFLINE_MODE,
      autoRewriteLinksOnRename:
        settings.autoRewriteLinksOnRename ?? globalSettings.autoRewriteLinksOnRename ?? DEFAULT_AUTO_REWRITE,
    });
  },

  reset() {
    set({
      autoRewriteLinksOnRename: DEFAULT_AUTO_REWRITE,
      dailyPathPattern: undefined,
      attachmentsFolder: undefined,
      offlineMode: DEFAULT_OFFLINE_MODE,
      vaultSettings: null,
    });
    persist({ autoRewriteLinksOnRename: DEFAULT_AUTO_REWRITE, offlineMode: DEFAULT_OFFLINE_MODE });
  },
}));

function persistedFromState(state: AppSettingsStore): PersistedAppSettings {
  return {
    autoRewriteLinksOnRename: state.autoRewriteLinksOnRename,
    offlineMode: state.offlineMode,
  };
}

function loadPersisted(): PersistedAppSettings {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedAppSettings(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function persist(settings: PersistedAppSettings) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function isPersistedAppSettings(value: unknown): value is PersistedAppSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as PersistedAppSettings;
  const autoRewriteValid =
    candidate.autoRewriteLinksOnRename === undefined || typeof candidate.autoRewriteLinksOnRename === "boolean";
  const offlineModeValid = candidate.offlineMode === undefined || typeof candidate.offlineMode === "boolean";
  return autoRewriteValid && offlineModeValid;
}
