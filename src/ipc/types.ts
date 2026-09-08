import type { CodeFont, EditorFont, UiFont } from "@/services/fontRuntime";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

export type IpcErrorKind = "Io" | "Parse" | "NotFound" | "Conflict" | "Other";

export type IpcErrorPayload = {
  kind: IpcErrorKind;
  message?: string;
  currentMtime?: number;
};

export type VaultPath = {
  path: string;
};

export type RecentVault = {
  path: string;
  name: string;
  missing: boolean;
};

export type AppSettings = {
  appearance: {
    density: "comfortable" | "compact";
    theme: "light" | "dark" | "system";
    uiFont: UiFont;
  };
  editor: {
    autoSaveDebounceMs: number;
    previewDefault: boolean;
    lineWrap: boolean;
    showLineNumbers: boolean;
    fontSize: number;
    lineHeight: number;
    fontFamily: EditorFont;
    codeFont: CodeFont;
    tabSize: number;
    livePreview: boolean;
    spellCheck: boolean;
  };
  vault: Record<string, never>;
  markdown: {
    callouts: boolean;
    footnotes: boolean;
    highlight: boolean;
  };
  assets: {
    offlineMode: boolean;
  };
  ai: AiSettings;
  layout?: {
    mode: "triage";
    triageNavWidth: number;
    triageListWidth: number;
  };
  updates?: {
    autoCheck: boolean;
  };
};

export type VaultSettings = {
  dailyPathPattern?: string;
  dailyTemplatePath?: string;
  attachmentsFolder?: string;
  offlineMode?: boolean;
  autoRewriteLinksOnRename?: boolean;
  gitAutoCommit?: boolean;
  tagLibrary?: string[];
  folderIcons?: Record<string, string>;
  folderColors?: Record<string, string>;
  archiveRetentionDays?: number;
  templatesFolder?: string;
};

// === F39 Templates ===
export type TemplateEntry = {
  name: string;
  path: string;
  relPath: string;
};

export type RenderedTemplate = {
  frontmatter: JsonRecord;
  body: string;
  /** UTF-16 code-unit offset of the first `{{cursor}}` marker in `body`, null when absent. */
  cursorOffset: number | null;
};

export type CreateFromTemplateInput = {
  folder: string;
  templatePath: string;
  title?: string;
};

export type CreateFromTemplateResult = {
  path: string;
  cursorOffset: number | null;
};

// === F40 Note Status ===
export type NoteStatus = "active" | "on-hold" | "done";

export type NoteEntry = {
  id: string;
  path: string;
  title: string;
  folder: string;
  snippet: string;
  size: number;
  mtime: number;
  ctime: number;
};

export type NoteFile = {
  path: string;
  frontmatter: JsonRecord;
  body: string;
  mtime: number;
};

export type SaveInput = {
  path: string;
  frontmatter: JsonRecord;
  body: string;
  expectedMtime?: number;
};

export type SaveResult = {
  path: string;
  mtime: number;
};

export type CreateNoteInput = {
  folder: string;
  title?: string;
};

export type RenameNoteInput = {
  oldPath: string;
  newName: string;
  rewrite?: boolean;
};

export type MoveNoteInput = {
  notePath: string;
  destFolder: string;
};

export type FolderPath = {
  path: string;
};

export type FolderCreateInput = {
  parent: string;
  name: string;
};

export type FolderRenameInput = {
  oldPath: string;
  newName: string;
};

export type FolderMoveInput = {
  srcPath: string;
  destParent: string;
};

export type BulkFailure = {
  path: string;
  error: IpcErrorPayload;
};

export type BulkPathResult = {
  ok: string[];
  failed: BulkFailure[];
};

export type BulkMoveResult = BulkPathResult;

export type BulkFrontmatterResult = BulkPathResult;

export type FileChangeKind = "created" | "modified" | "removed";
export type FileChangeSource = "internal" | "external";
export type FolderChangeKind = "created" | "renamed" | "removed" | "moved";

export type VaultOpenedEvent = VaultPath;
export type VaultClosedEvent = { previousPath: string | null };

export type VaultFileChangedEvent = {
  path: string;
  kind: FileChangeKind;
  source: FileChangeSource;
  mtime: number;
  size: number;
};

export type VaultFileRenamedEvent = {
  oldPath: string;
  newPath: string;
};

export type VaultFolderChangedEvent = {
  path: string;
  oldPath?: string;
  kind: FolderChangeKind;
  source: FileChangeSource;
};

// === F18 VCS ===
export type CommitEntry = {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  isoDate: string;
};

export type SyncStatus = "idle" | "syncing" | "error";

export type SyncErrorKind = "auth" | "network" | "other";

export type RemoteInfo = {
  enabled: boolean;
  url: string | null;
  syncStatus: SyncStatus;
  lastPush: string | null;
  lastPull: string | null;
  lastError: string | null;
  /** Optional: absent on snapshots from builds older than F41-T04. */
  errorKind?: SyncErrorKind | null;
};

export type GhAccount = {
  user: string;
  host: string;
};

export type DeployKeyInfo = {
  publicKey: string;
  fingerprint: string | null;
  alreadyExisted: boolean;
};

export type VcsStatus = {
  enabled: boolean;
  repoPath: string | null;
  hasGit: boolean;
  hasGh: boolean;
  ghAccount: GhAccount | null;
  remote: RemoteInfo | null;
};

export type ArchivedNoteEntry = {
  path: string;
  title: string;
  archivedAt: string;
  archivedFrom: string;
  daysRemaining: number | null;
  mtime: number;
};

export type AiProvider = "disabled" | "claude" | "copilot" | "codex";

export type AiError = {
  kind:
    | "provider_disabled"
    | "binary_not_found"
    | "subprocess_failed"
    | "timeout"
    | "skill_not_found"
    | "internal"
    | "invalid_model";
  message: string;
};

/** How this copy of Cork was installed — drives the upgrade instructions. */
export type InstallChannelSlug =
  | "homebrewCask"
  | "homebrewFormula"
  | "winget"
  | "appImage"
  | "systemPackage"
  | "direct"
  | "dev";

export type InstallChannel = {
  channel: InstallChannelSlug;
  /** Upgrade command to show, when the channel has one. */
  command: string | null;
  label: string;
};

/** Model chosen per cost tier. Empty means the provider's own default. */
export type TierModels = {
  small: string;
  standard: string;
  premium: string;
};

export type AiModelSettings = {
  claude: TierModels;
  copilot: TierModels;
  codex: TierModels;
};

export type AiSettings = {
  provider: AiProvider;
  models: AiModelSettings;
};

export type ModelChoice = {
  id: string;
  label: string;
  /** Aliases track the newest release of a family, so they age better. */
  isAlias: boolean;
  /** `fast` | `standard` | `deep` when this is the provider's pick for a tier. */
  tierHint: string | null;
};

export type ProviderModels = {
  provider: string;
  models: ModelChoice[];
};

export type ModelTestResult = {
  ok: boolean;
  message: string;
};
