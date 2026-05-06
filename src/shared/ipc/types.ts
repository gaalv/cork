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

export type VaultSettings = {
  dailyPathPattern?: string;
  attachmentsFolder?: string;
  offlineMode?: boolean;
  autoRewriteLinksOnRename?: boolean;
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
