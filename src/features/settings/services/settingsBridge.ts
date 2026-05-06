import { useAppSettingsStore } from "../state/appSettingsStore";
import { resolvedVaultSettings, useVaultSettingsStore } from "../state/vaultSettingsStore";

import type { SettingKey, SettingScope, SettingsChangedDetail } from "../state/settingsTypes";

type SettingValue = string | number | boolean;

const eventTarget = new EventTarget();

export const settingsBridge = {
  get(key: SettingKey): SettingValue {
    const app = useAppSettingsStore.getState().settings;
    const vault = resolvedVaultSettings(useVaultSettingsStore.getState().settings);
    switch (key) {
      case "appearance.density":
        return app.appearance.density;
      case "appearance.theme":
        return app.appearance.theme;
      case "editor.autoSaveDebounceMs":
        return app.editor.autoSaveDebounceMs;
      case "editor.previewDefault":
        return app.editor.previewDefault;
      case "vault.attachmentsFolder":
        return vault.attachmentsFolder;
      case "vault.recentLimit":
        return app.vault.recentLimit;
      case "wikilinks.autoRewriteOnRename":
        return vault.autoRewriteLinksOnRename;
      case "markdown.callouts":
        return app.markdown.callouts;
      case "markdown.footnotes":
        return app.markdown.footnotes;
      case "daily.pathPattern":
        return vault.dailyPathPattern;
      case "daily.templatePath":
        return vault.dailyTemplatePath;
      case "assets.offlineMode":
        return app.assets.offlineMode;
    }
  },

  async set(key: SettingKey, value: SettingValue, scope: SettingScope): Promise<void> {
    if (scope === "vault") {
      await setVaultSetting(key, value);
    } else {
      await setGlobalSetting(key, value);
    }
    emitChanged({ key, scope, value });
  },

  onChanged(callback: (detail: SettingsChangedDetail) => void): () => void {
    const listener = (event: Event) => callback((event as CustomEvent<SettingsChangedDetail>).detail);
    eventTarget.addEventListener("settings.changed", listener);
    return () => eventTarget.removeEventListener("settings.changed", listener);
  },
};

async function setGlobalSetting(key: SettingKey, value: SettingValue): Promise<void> {
  const store = useAppSettingsStore.getState();
  const current = store.settings;
  switch (key) {
    case "appearance.density":
      await store.updateSettings({ appearance: { ...current.appearance, density: value === "compact" ? "compact" : "comfortable" } });
      return;
    case "appearance.theme":
      await store.updateSettings({ appearance: { ...current.appearance, theme: "light" } });
      return;
    case "editor.autoSaveDebounceMs":
      await store.updateSettings({ editor: { ...current.editor, autoSaveDebounceMs: Number(value) } });
      return;
    case "editor.previewDefault":
      await store.updateSettings({ editor: { ...current.editor, previewDefault: Boolean(value) } });
      return;
    case "vault.recentLimit":
      await store.updateSettings({ vault: { recentLimit: Number(value) } });
      return;
    case "markdown.callouts":
      await store.updateSettings({ markdown: { ...current.markdown, callouts: Boolean(value) } });
      return;
    case "markdown.footnotes":
      await store.updateSettings({ markdown: { ...current.markdown, footnotes: Boolean(value) } });
      return;
    case "assets.offlineMode":
      await store.updateSettings({ assets: { offlineMode: Boolean(value) } });
      return;
    case "vault.attachmentsFolder":
    case "wikilinks.autoRewriteOnRename":
    case "daily.pathPattern":
    case "daily.templatePath":
      throw new Error(`${key} is a per-vault setting`);
  }
}

async function setVaultSetting(key: SettingKey, value: SettingValue): Promise<void> {
  const store = useVaultSettingsStore.getState();
  switch (key) {
    case "vault.attachmentsFolder":
      await store.update({ attachmentsFolder: String(value) });
      return;
    case "wikilinks.autoRewriteOnRename":
      await store.update({ autoRewriteLinksOnRename: Boolean(value) });
      return;
    case "daily.pathPattern":
      await store.update({ dailyPathPattern: String(value) });
      return;
    case "daily.templatePath":
      await store.update({ dailyTemplatePath: String(value) });
      return;
    case "appearance.density":
    case "appearance.theme":
    case "editor.autoSaveDebounceMs":
    case "editor.previewDefault":
    case "vault.recentLimit":
    case "markdown.callouts":
    case "markdown.footnotes":
    case "assets.offlineMode":
      throw new Error(`${key} is a global setting`);
  }
}

function emitChanged(detail: SettingsChangedDetail) {
  eventTarget.dispatchEvent(new CustomEvent("settings.changed", { detail }));
}
