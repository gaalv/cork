import type {
  CreateNoteInput,
  NoteEntry,
  NoteFile,
  RenameNoteInput,
  SaveInput,
  SaveResult,
  VaultFileChangedEvent,
  VaultFileRenamedEvent,
  VaultOpenedEvent,
  VaultPath,
} from "./types";

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
};

export type IpcCommandName = keyof IpcCommandMap;
export type IpcCommandArgs<Name extends IpcCommandName> = IpcCommandMap[Name]["args"];
export type IpcCommandResult<Name extends IpcCommandName> = IpcCommandMap[Name]["result"];

export type IpcEventMap = {
  "vault.opened": VaultOpenedEvent;
  "vault.fileChanged": VaultFileChangedEvent;
  "vault.fileRenamed": VaultFileRenamedEvent;
};

export type IpcEventName = keyof IpcEventMap;
export type IpcEventPayload<Name extends IpcEventName> = IpcEventMap[Name];
