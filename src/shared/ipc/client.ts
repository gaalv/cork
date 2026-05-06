import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  IpcCommandArgs,
  IpcCommandName,
  IpcCommandResult,
  IpcEventName,
  IpcEventPayload,
} from "./IpcContract";
import type { CreateNoteInput, RenameNoteInput, SaveInput } from "./types";

const commandNames: Record<IpcCommandName, string> = {
  health: "health",
  "vault.open": "vault_open",
  "vault.current": "vault_current",
  "vault.list": "vault_list",
  "vault.watcherStart": "vault_watcher_start",
  "vault.watcherStop": "vault_watcher_stop",
  "notes.read": "notes_read",
  "notes.save": "notes_save",
  "notes.create": "notes_create",
  "notes.rename": "notes_rename",
  "notes.trash": "notes_trash",
};

type RustArgs = Record<string, unknown> | undefined;

export async function invokeCommand<Name extends IpcCommandName>(
  command: Name,
  args: IpcCommandArgs<Name>,
): Promise<IpcCommandResult<Name>> {
  return invoke<IpcCommandResult<Name>>(commandNames[command], toRustArgs(command, args));
}

export const client = {
  health: () => invokeCommand("health", undefined),
  vault: {
    open: () => invokeCommand("vault.open", undefined),
    current: () => invokeCommand("vault.current", undefined),
    list: () => invokeCommand("vault.list", undefined),
    watcherStart: () => invokeCommand("vault.watcherStart", undefined),
    watcherStop: () => invokeCommand("vault.watcherStop", undefined),
  },
  notes: {
    read: (path: string) => invokeCommand("notes.read", { path }),
    save: (input: SaveInput) => invokeCommand("notes.save", input),
    create: (input: CreateNoteInput) => invokeCommand("notes.create", input),
    rename: (input: RenameNoteInput) => invokeCommand("notes.rename", input),
    trash: (path: string) => invokeCommand("notes.trash", { path }),
  },
  events: {
    on: <Name extends IpcEventName>(
      event: Name,
      callback: (payload: IpcEventPayload<Name>) => void,
    ) => listen<IpcEventPayload<Name>>(event, ({ payload }) => callback(camelize(payload) as IpcEventPayload<Name>)),
  },
};

function toRustArgs<Name extends IpcCommandName>(command: Name, args: IpcCommandArgs<Name>): RustArgs {
  switch (command) {
    case "health":
    case "vault.open":
    case "vault.current":
    case "vault.list":
    case "vault.watcherStart":
    case "vault.watcherStop":
      return undefined;
    case "notes.read":
    case "notes.trash":
      return args as RustArgs;
    case "notes.save":
      return { input: args };
    case "notes.create": {
      const input = args as CreateNoteInput;
      return { folder: input.folder, title: input.title };
    }
    case "notes.rename": {
      const input = args as RenameNoteInput;
      return { oldPath: input.oldPath, newName: input.newName };
    }
  }
}

function camelize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [snakeToCamel(key), camelize(nested)]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
