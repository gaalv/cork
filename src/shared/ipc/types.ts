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
};

export type FileChangeKind = "created" | "modified" | "removed";
export type FileChangeSource = "internal" | "external";

export type VaultOpenedEvent = VaultPath;

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
