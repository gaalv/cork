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
};

export type VaultSettings = {
  dailyPathPattern?: string;
  dailyTemplatePath?: string;
  attachmentsFolder?: string;
  offlineMode?: boolean;
  autoRewriteLinksOnRename?: boolean;
  gitAutoCommit?: boolean;
  tagLibrary?: string[];
};

export type NoteEntry = {
  id: string;
  path: string;
  title: string;
  folder: string;
  size: number;
  mtime: number;
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

export type RemoteInfo = {
  enabled: boolean;
  url: string | null;
  syncStatus: SyncStatus;
  lastPush: string | null;
  lastPull: string | null;
  lastError: string | null;
};

export type VcsStatus = {
  enabled: boolean;
  repoPath: string | null;
  hasGit: boolean;
  hasGh: boolean;
  remote: RemoteInfo | null;
};

export type AiProvider = "disabled" | "claude" | "copilot";

export type AiError = {
  kind: "provider_disabled" | "binary_not_found" | "subprocess_failed" | "timeout";
  message: string;
};
