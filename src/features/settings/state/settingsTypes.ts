export type AppearanceDensity = "comfortable" | "compact";
export type AppearanceTheme = "light";

export type AppSettings = {
  appearance: {
    density: AppearanceDensity;
    theme: AppearanceTheme;
  };
  editor: {
    autoSaveDebounceMs: number;
    previewDefault: boolean;
  };
  vault: {
    recentLimit: number;
  };
  markdown: {
    callouts: boolean;
    footnotes: boolean;
  };
  assets: {
    offlineMode: boolean;
  };
};

export type VaultScopedSettings = {
  dailyPathPattern?: string;
  dailyTemplatePath?: string;
  attachmentsFolder?: string;
  autoRewriteLinksOnRename?: boolean;
};

export type SettingScope = "global" | "vault";

export type SettingKey =
  | "appearance.density"
  | "appearance.theme"
  | "editor.autoSaveDebounceMs"
  | "editor.previewDefault"
  | "vault.attachmentsFolder"
  | "vault.recentLimit"
  | "wikilinks.autoRewriteOnRename"
  | "markdown.callouts"
  | "markdown.footnotes"
  | "daily.pathPattern"
  | "daily.templatePath"
  | "assets.offlineMode";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appearance: { density: "comfortable", theme: "light" },
  editor: { autoSaveDebounceMs: 500, previewDefault: true },
  vault: { recentLimit: 8 },
  markdown: { callouts: true, footnotes: true },
  assets: { offlineMode: false },
};

export const DEFAULT_VAULT_SETTINGS: Required<VaultScopedSettings> = {
  attachmentsFolder: "_attachments",
  autoRewriteLinksOnRename: true,
  dailyPathPattern: "Daily/YYYY/MM/YYYY-MM-DD.md",
  dailyTemplatePath: ".noxe/templates/daily.md",
};

export type SettingsChangedDetail = {
  key: SettingKey;
  scope: SettingScope;
  value: string | number | boolean;
};
