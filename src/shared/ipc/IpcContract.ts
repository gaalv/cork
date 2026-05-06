import type {
  BulkFrontmatterResult,
  BulkMoveResult,
  BulkPathResult,
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
  VaultFileChangedEvent,
  VaultFileRenamedEvent,
  VaultFolderChangedEvent,
  VaultOpenedEvent,
  VaultPath,
} from "./types";

export type TagCount = {
  tag: string;
  count: number;
};

export type LinkRow = {
  srcNoteId: string;
  targetText: string;
  targetId: string | null;
  position: number;
  alias: string | null;
  ambiguous: boolean;
};

export type SearchResult = NoteEntry & {
  snippet: string;
  rank: number;
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
    args: undefined;
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
  // === F11 Assets ===
  "assets.setScope": {
    args: { vaultRoot: string };
    result: { vaultRoot: string };
  };
  "assets.writeAttachment": {
    args: { sourcePath?: string; bytes?: number[]; suggestedName: string; vaultRelDir?: string };
    result: { path: string; relativePath: string };
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
  "notes.recent": {
    args: { limit?: number };
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
  "notes.starred": {
    args: undefined;
    result: NoteEntry[];
  };
  "notes.search": {
    args: { query: string; limit?: number };
    result: SearchResult[];
  };
  "tags.list": {
    args: undefined;
    result: TagCount[];
  };
  "links.outgoing": {
    args: { noteId: string };
    result: LinkRow[];
  };
  "links.incoming": {
    args: { noteId: string };
    result: LinkRow[];
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
};

export type IpcCommandName = keyof IpcCommandMap;
export type IpcCommandArgs<Name extends IpcCommandName> = IpcCommandMap[Name]["args"];
export type IpcCommandResult<Name extends IpcCommandName> = IpcCommandMap[Name]["result"];

export type IpcEventMap = {
  "vault.opened": VaultOpenedEvent;
  "vault.fileChanged": VaultFileChangedEvent;
  "vault.fileRenamed": VaultFileRenamedEvent;
  "vault.folderChanged": VaultFolderChangedEvent;
  "index.progress": IndexProgressEvent;
  "index.ready": IndexStatus;
  "index.error": IndexErrorEvent;
};

export type IpcEventName = keyof IpcEventMap;
export type IpcEventPayload<Name extends IpcEventName> = IpcEventMap[Name];
