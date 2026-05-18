export type AppearanceDensity = "comfortable" | "compact";
export type AppearanceTheme = "light" | "dark" | "system";
export type AiProvider = "disabled" | "claude" | "copilot";
export type LayoutMode = "focus" | "triage";

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
  ai: {
    provider: AiProvider;
  };
  layout: {
    mode: LayoutMode;
    triageNavWidth: number;
    triageListWidth: number;
  };
  updates: {
    autoCheck: boolean;
  };
};

export type VaultScopedSettings = {
  dailyPathPattern?: string;
  dailyTemplatePath?: string;
  attachmentsFolder?: string;
  autoRewriteLinksOnRename?: boolean;
  offlineMode?: boolean;
  gitAutoCommit?: boolean;
  tagLibrary?: string[];
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
  | "vcs.gitAutoCommit"
  | "ai.provider"
  | "layout.mode"
  | "layout.triageNavWidth"
  | "layout.triageListWidth";

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
  ai: { provider: "disabled" },
  layout: { mode: "focus", triageNavWidth: 240, triageListWidth: 320 },
  updates: { autoCheck: true },
};

export const DEFAULT_VAULT_SETTINGS: Required<VaultScopedSettings> = {
  attachmentsFolder: "_attachments",
  autoRewriteLinksOnRename: true,
  dailyPathPattern: "Daily/YYYY/MM/YYYY-MM-DD.md",
  dailyTemplatePath: ".noxe/templates/daily.md",
  offlineMode: false,
  gitAutoCommit: true,
  tagLibrary: [],
};

export type SettingsChangedDetail = {
  key: SettingKey;
  scope: SettingScope;
  value: string | number | boolean;
};
