import type {
  BulkFrontmatterResult,
  BulkMoveResult,
  BulkPathResult,
  CommitEntry,
  CreateNoteInput,
  FolderCreateInput,
  FolderMoveInput,
  FolderPath,
  FolderRenameInput,
  JsonRecord,
  MoveNoteInput,
  NoteEntry,
  NoteFile,
  RenameNoteInput,
  SaveInput,
  SaveResult,
  RecentVault,
  VaultClosedEvent,
  VaultFileChangedEvent,
  VaultFileRenamedEvent,
  VaultFolderChangedEvent,
  VaultOpenedEvent,
  VaultPath,
  VaultSettings,
  AppSettings,
  VcsStatus,
  RemoteInfo,
  DeployKeyInfo,
  ArchivedNoteEntry,
} from "./types";

export type TagCount = {
  tag: string;
  count: number;
};

export type NoteTagPair = {
  noteId: string;
  tag: string;
};

export type LinkRow = {
  srcNoteId: string;
  targetText: string;
  targetId: string | null;
  position: number;
  alias: string | null;
  ambiguous: boolean;
};

export type GraphNode = {
  id: string;
  title: string;
  folder: string;
  linkCount: number;
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type SearchResult = NoteEntry & {
  snippet: string;
  rank: number;
};

export type ScaffoldResult = {
  created: boolean;
  files: string[];
};

export type IndexStatus = {
  ready: boolean;
  vaultPath: string | null;
  indexedNotes: number;
  pendingJobs: number;
};

export type IndexProgressEvent = {
  processed: number;
  total: number;
  phase: "building" | "updating" | "removing" | "renaming";
};

export type IndexErrorEvent = {
  message: string;
};

export type IpcCommandMap = {
  health: {
    args: undefined;
    result: string;
  };
  "vault.open": {
    args: { path?: string } | undefined;
    result: VaultPath;
  };
  "vault.current": {
    args: undefined;
    result: VaultPath | null;
  };
  "vault.list": {
    args: undefined;
    result: NoteEntry[];
  };
  "vault.watcherStart": {
    args: undefined;
    result: void;
  };
  "vault.watcherStop": {
    args: undefined;
    result: void;
  };
  // === F10 Vault Mgmt ===
  "vault.close": {
    args: undefined;
    result: void;
  };
  "vault.recent": {
    args: undefined;
    result: RecentVault[];
  };
  "vault.removeRecent": {
    args: { path: string };
    result: void;
  };
  "vault.settings": {
    args: undefined;
    result: VaultSettings;
  };
  "vault.scaffoldIfNeeded": {
    args: undefined;
    result: ScaffoldResult;
  };
  // === F13 Settings ===
  "settings.appLoad": {
    args: undefined;
    result: AppSettings;
  };
  "settings.appSave": {
    args: { settings: AppSettings };
    result: AppSettings;
  };
  "settings.vaultLoad": {
    args: undefined;
    result: VaultSettings;
  };
  "settings.vaultSave": {
    args: { settings: VaultSettings };
    result: VaultSettings;
  };
  // === F11 Assets ===
  "assets.setScope": {
    args: { vaultRoot: string };
    result: { vaultRoot: string };
  };
  "assets.writeAttachment": {
    args: { sourcePath?: string; bytes?: number[]; suggestedName: string; vaultRelDir?: string };
    result: { path: string; relativePath: string };
  };
  // === Archive ===
  "archive.note": {
    args: { path: string };
    result: string;
  };
  "archive.restore": {
    args: { path: string };
    result: string;
  };
  "archive.list": {
    args: undefined;
    result: ArchivedNoteEntry[];
  };
  // === F12 Folder Ops ===
  "folders.create": {
    args: FolderCreateInput;
    result: FolderPath;
  };
  "folders.rename": {
    args: FolderRenameInput;
    result: FolderPath;
  };
  "folders.move": {
    args: FolderMoveInput;
    result: FolderPath;
  };
  "folders.trash": {
    args: { path: string };
    result: void;
  };
  "folders.list": {
    args: undefined;
    result: string[];
  };
  "notes.read": {
    args: { path: string };
    result: NoteFile;
  };
  "notes.save": {
    args: SaveInput;
    result: SaveResult;
  };
  "notes.create": {
    args: CreateNoteInput;
    result: VaultPath;
  };
  "notes.rename": {
    args: RenameNoteInput;
    result: VaultPath;
  };
  "notes.trash": {
    args: { path: string };
    result: void;
  };
  // === F12 Bulk Ops ===
  "notes.move": {
    args: MoveNoteInput;
    result: FolderPath;
  };
  "notes.bulkMove": {
    args: { paths: string[]; destFolder: string };
    result: BulkMoveResult;
  };
  "notes.bulkTrash": {
    args: { paths: string[] };
    result: BulkPathResult;
  };
  "notes.bulkSetFrontmatter": {
    args: { paths: string[]; patch: JsonRecord };
    result: BulkFrontmatterResult;
  };
  // === F06/F08 ===
  "notes.allPaged": {
    args: { offset: number; limit: number };
    result: NoteEntry[];
  };
  "notes.byTag": {
    args: { tag: string };
    result: NoteEntry[];
  };
  "notes.byFolder": {
    args: { folder: string };
    result: NoteEntry[];
  };
  "notes.byId": {
    args: { id: string };
    result: NoteEntry | null;
  };
  // === F07 Drawers ===
  "notes.pinned": {
    args: undefined;
    result: NoteEntry[];
  };
  "tags.create": {
    args: { tag: string };
    result: null;
  };
  "tags.list": {
    args: undefined;
    result: TagCount[];
  };
  "tags.noteMap": {
    args: undefined;
    result: NoteTagPair[];
  };
  "tags.rename": {
    args: { oldTag: string; newTag: string };
    result: null;
  };
  "tags.delete": {
    args: { tag: string };
    result: null;
  };
  "links.outgoing": {
    args: { noteId: string };
    result: LinkRow[];
  };
  "links.incoming": {
    args: { noteId: string };
    result: LinkRow[];
  };
  "links.graph": {
    args: undefined;
    result: GraphData;
  };
  "index.search": {
    args: { query: string; limit?: number };
    result: SearchResult[];
  };
  "index.status": {
    args: undefined;
    result: IndexStatus;
  };
  "index.rebuild": {
    args: undefined;
    result: void;
  };
  // === F18 VCS ===
  "vcs.status": {
    args: undefined;
    result: VcsStatus;
  };
  "vcs.history": {
    args: { notePath: string; limit?: number };
    result: CommitEntry[];
  };
  "vcs.restore": {
    args: { notePath: string; sha: string };
    result: void;
  };
  "vcs.remoteEnable": {
    args: { url?: string; token?: string };
    result: RemoteInfo;
  };
  "vcs.remoteClone": {
    args: { url: string; token: string; parentPath?: string };
    result: VaultPath;
  };
  "vcs.remoteDisable": {
    args: undefined;
    result: RemoteInfo;
  };
  "vcs.remoteSyncNow": {
    args: undefined;
    result: RemoteInfo;
  };
  "vcs.generateDeployKey": {
    args: undefined;
    result: DeployKeyInfo;
  };
  // === F21 AI Infrastructure ===
  "ai.runSkill": {
    args: { skillId: string; variables: Record<string, string> };
    result: AiSkillResult;
  };
  "ai.cacheClear": {
    args: { skillId?: string };
    result: number;
  };
  "ai.skillsReload": {
    args: undefined;
    result: number;
  };
  "ai.skillsList": {
    args: undefined;
    result: SkillSummary[];
  };
  "ai.stats": {
    args: { since?: number };
    result: AiStats;
  };
  "ai.telemetryClear": {
    args: undefined;
    result: number;
  };
  "ai.providersAvailable": {
    args: undefined;
    result: ProvidersAvailable;
  };
  // === F35 Diagnostics ===
  "diagnostics.reportError": {
    args: {
      source: string;
      message: string;
      stack?: string;
      route?: string;
      version?: string;
    };
    result: void;
  };
  "diagnostics.crashLogPath": {
    args: undefined;
    result: string;
  };
  "diagnostics.recent": {
    args: { limit?: number };
    result: CrashEvent[];
  };
};

export type CrashEvent = {
  timestamp: string;
  source: string;
  message: string;
  stack?: string;
  route?: string;
  version?: string;
};

export type AiSkillResult = {
  output: string;
  cacheHit: boolean;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  skillId: string;
};

export type SkillSummary = {
  id: string;
  name: string;
  source: string;
  triggers: string[];
};

export type AiStats = {
  callsTotal: number;
  cacheHitRate: number;
  tokensIn: number;
  tokensOut: number;
  bySkill: Array<{ skillId: string; calls: number; tokens: number }>;
  cacheRows: number;
  cacheBytes: number;
};

export type ProvidersAvailable = {
  claude: boolean;
  copilot: boolean;
};

export type AiSkillError = {
  kind:
    | "provider_disabled"
    | "binary_not_found"
    | "subprocess_failed"
    | "timeout"
    | "skill_not_found"
    | "internal";
  message: string;
};

export type IpcCommandName = keyof IpcCommandMap;
export type IpcCommandArgs<Name extends IpcCommandName> = IpcCommandMap[Name]["args"];
export type IpcCommandResult<Name extends IpcCommandName> = IpcCommandMap[Name]["result"];

export type IpcEventMap = {
  "vault:opened": VaultOpenedEvent;
  "vault:closed": VaultClosedEvent;
  "vault:fileChanged": VaultFileChangedEvent;
  "vault:fileRenamed": VaultFileRenamedEvent;
  "vault:folderChanged": VaultFolderChangedEvent;
  "index:progress": IndexProgressEvent;
  "index:ready": IndexStatus;
  "index:error": IndexErrorEvent;
  "index:updated": null;
};

export type IpcEventName = keyof IpcEventMap;
export type IpcEventPayload<Name extends IpcEventName> = IpcEventMap[Name];
