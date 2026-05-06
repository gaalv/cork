import { create } from "zustand";

type PersistedAppSettings = {
  autoRewriteLinksOnRename?: boolean;
};

type AppSettingsStore = {
  autoRewriteLinksOnRename: boolean;
  setAutoRewriteLinksOnRename: (enabled: boolean) => void;
  reset: () => void;
};

const STORAGE_KEY = "noxe.appSettings";
const DEFAULT_AUTO_REWRITE = true;

const persisted = loadPersisted();

export const useAppSettingsStore = create<AppSettingsStore>((set) => ({
  autoRewriteLinksOnRename: persisted.autoRewriteLinksOnRename ?? DEFAULT_AUTO_REWRITE,

  setAutoRewriteLinksOnRename(enabled) {
    set({ autoRewriteLinksOnRename: enabled });
    persist({ autoRewriteLinksOnRename: enabled });
  },

  reset() {
    set({ autoRewriteLinksOnRename: DEFAULT_AUTO_REWRITE });
    persist({ autoRewriteLinksOnRename: DEFAULT_AUTO_REWRITE });
  },
}));

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
  return candidate.autoRewriteLinksOnRename === undefined || typeof candidate.autoRewriteLinksOnRename === "boolean";
}
