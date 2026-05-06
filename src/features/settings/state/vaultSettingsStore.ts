import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import { DEFAULT_VAULT_SETTINGS } from "./settingsTypes";

import type { VaultScopedSettings } from "./settingsTypes";
import type { VaultSettings } from "@/shared/ipc/types";

type VaultSettingsStore = {
  settings: VaultScopedSettings;
  hasVault: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  save: (settings: VaultScopedSettings) => Promise<void>;
  update: (patch: VaultScopedSettings) => Promise<void>;
  apply: (settings: VaultSettings, hasVault?: boolean) => void;
  reset: () => void;
};

export const useVaultSettingsStore = create<VaultSettingsStore>((set, get) => ({
  settings: {},
  hasVault: false,
  isLoading: false,

  async load() {
    set({ isLoading: true });
    try {
      const settings = await client.settings.vaultLoad();
      get().apply(settings, true);
    } catch {
      set({ settings: {}, hasVault: false, isLoading: false });
    }
  },

  async save(settings) {
    const saved = await client.settings.vaultSave(settings);
    get().apply(saved, true);
  },

  async update(patch) {
    await get().save({ ...get().settings, ...patch });
  },

  apply(settings, hasVault = true) {
    set({ settings: normalizeVaultSettings(settings), hasVault, isLoading: false });
  },

  reset() {
    set({ settings: {}, hasVault: false, isLoading: false });
  },
}));

export function resolvedVaultSettings(settings: VaultScopedSettings): Required<VaultScopedSettings> {
  return {
    attachmentsFolder: settings.attachmentsFolder ?? DEFAULT_VAULT_SETTINGS.attachmentsFolder,
    autoRewriteLinksOnRename: settings.autoRewriteLinksOnRename ?? DEFAULT_VAULT_SETTINGS.autoRewriteLinksOnRename,
    dailyPathPattern: settings.dailyPathPattern ?? DEFAULT_VAULT_SETTINGS.dailyPathPattern,
    dailyTemplatePath: settings.dailyTemplatePath ?? DEFAULT_VAULT_SETTINGS.dailyTemplatePath,
  };
}

export function normalizeVaultSettings(value: unknown): VaultScopedSettings {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const candidate = value as VaultScopedSettings;
  return {
    attachmentsFolder: stringOrUndefined(candidate.attachmentsFolder),
    autoRewriteLinksOnRename: booleanOrUndefined(candidate.autoRewriteLinksOnRename),
    dailyPathPattern: stringOrUndefined(candidate.dailyPathPattern),
    dailyTemplatePath: stringOrUndefined(candidate.dailyTemplatePath),
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
