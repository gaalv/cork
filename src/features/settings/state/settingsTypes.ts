export type AppearanceDensity = "comfortable" | "compact";
export type AppearanceTheme = "light" | "dark" | "system";

export type AppSettings = {
  appearance: {
    density: AppearanceDensity;
    theme: AppearanceTheme;
  };
  editor: {
    autoSaveDebounceMs: number;
    previewDefault: boolean;
    lineWrap: boolean;
    showLineNumbers: boolean;
    fontFamily: string;
    fontSize: number;
    tabSize: number;
    showInvisibles: boolean;
  };
  vault: {
    recentLimit: number;
  };
  markdown: {
    callouts: boolean;
    footnotes: boolean;
    highlight: boolean;
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
  offlineMode?: boolean;
  gitAutoCommit?: boolean;
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
  | "markdown.highlight"
  | "daily.pathPattern"
  | "daily.templatePath"
  | "assets.offlineMode"
  | "vcs.gitAutoCommit";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appearance: { density: "comfortable", theme: "system" },
  editor: {
    autoSaveDebounceMs: 500,
    previewDefault: true,
    lineWrap: true,
    showLineNumbers: false,
    fontFamily: "system-ui",
    fontSize: 14,
    tabSize: 2,
    showInvisibles: false,
  },
  vault: { recentLimit: 8 },
  markdown: { callouts: true, footnotes: true, highlight: true },
  assets: { offlineMode: false },
};

export const DEFAULT_VAULT_SETTINGS: Required<VaultScopedSettings> = {
  attachmentsFolder: "_attachments",
  autoRewriteLinksOnRename: true,
  dailyPathPattern: "Daily/YYYY/MM/YYYY-MM-DD.md",
  dailyTemplatePath: ".noxe/templates/daily.md",
  offlineMode: false,
  gitAutoCommit: true,
};

export type SettingsChangedDetail = {
  key: SettingKey;
  scope: SettingScope;
  value: string | number | boolean;
};
