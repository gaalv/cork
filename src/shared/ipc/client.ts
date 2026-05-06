import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  IpcCommandArgs,
  IpcCommandName,
  IpcCommandResult,
  IpcEventName,
  IpcEventPayload,
} from "./IpcContract";
import type {
  CreateNoteInput,
  FolderCreateInput,
  FolderMoveInput,
  FolderRenameInput,
  JsonRecord,
  MoveNoteInput,
  RenameNoteInput,
  SaveInput,
} from "./types";

const commandNames: Record<IpcCommandName, string> = {
  health: "health",
  "vault.open": "vault_open",
  "vault.current": "vault_current",
  "vault.list": "vault_list",
  "vault.watcherStart": "vault_watcher_start",
  "vault.watcherStop": "vault_watcher_stop",
  "assets.setScope": "assets_set_scope",
  "folders.create": "folders_create",
  "folders.rename": "folders_rename",
  "folders.move": "folders_move",
  "folders.trash": "folders_trash",
  "notes.read": "notes_read",
  "notes.save": "notes_save",
  "notes.create": "notes_create",
  "notes.rename": "notes_rename",
  "notes.trash": "notes_trash",
  "notes.move": "notes_move",
  "notes.bulkMove": "notes_bulk_move",
  "notes.bulkTrash": "notes_bulk_trash",
  "notes.bulkSetFrontmatter": "notes_bulk_set_frontmatter",
  "notes.recent": "notes_recent",
  "notes.byTag": "notes_by_tag",
  "notes.byFolder": "notes_by_folder",
  "notes.byId": "notes_by_id",
  "notes.search": "notes_search",
  "tags.list": "tags_list",
  "links.outgoing": "links_outgoing",
  "links.incoming": "links_incoming",
  "index.search": "index_search",
  "index.status": "index_status",
  "index.rebuild": "index_rebuild",
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
  assets: {
    setScope: (vaultRoot: string) => invokeCommand("assets.setScope", { vaultRoot }),
  },
  folders: {
    create: (input: FolderCreateInput) => invokeCommand("folders.create", input),
    rename: (input: FolderRenameInput) => invokeCommand("folders.rename", input),
    move: (input: FolderMoveInput) => invokeCommand("folders.move", input),
    trash: (path: string) => invokeCommand("folders.trash", { path }),
  },
  notes: {
    read: (path: string) => invokeCommand("notes.read", { path }),
    save: (input: SaveInput) => invokeCommand("notes.save", input),
    create: (input: CreateNoteInput) => invokeCommand("notes.create", input),
    rename: (input: RenameNoteInput) => invokeCommand("notes.rename", input),
    trash: (path: string) => invokeCommand("notes.trash", { path }),
    move: (input: MoveNoteInput) => invokeCommand("notes.move", input),
    bulkMove: (paths: string[], destFolder: string) => invokeCommand("notes.bulkMove", { paths, destFolder }),
    bulkTrash: (paths: string[]) => invokeCommand("notes.bulkTrash", { paths }),
    bulkSetFrontmatter: (paths: string[], patch: JsonRecord) =>
      invokeCommand("notes.bulkSetFrontmatter", { paths, patch }),
    recent: (limit?: number) => invokeCommand("notes.recent", { limit }),
    byTag: (tag: string) => invokeCommand("notes.byTag", { tag }),
    byFolder: (folder: string) => invokeCommand("notes.byFolder", { folder }),
    byId: (id: string) => invokeCommand("notes.byId", { id }),
    search: (query: string, limit?: number) => invokeCommand("notes.search", { query, limit }),
  },
  tags: {
    list: () => invokeCommand("tags.list", undefined),
  },
  links: {
    outgoing: (noteId: string) => invokeCommand("links.outgoing", { noteId }),
    incoming: (noteId: string) => invokeCommand("links.incoming", { noteId }),
  },
  index: {
    search: (query: string, limit?: number) => invokeCommand("index.search", { query, limit }),
    status: () => invokeCommand("index.status", undefined),
    rebuild: () => invokeCommand("index.rebuild", undefined),
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
    case "tags.list":
    case "index.status":
    case "index.rebuild":
      return undefined;
    case "folders.trash":
    case "notes.read":
    case "notes.trash":
    case "notes.recent":
    case "notes.byId":
    case "notes.search":
    case "links.outgoing":
    case "links.incoming":
    case "index.search":
      return args as RustArgs;
    case "notes.byTag": {
      const input = args as { tag: string };
      return { tag: input.tag };
    }
    case "notes.byFolder": {
      const input = args as { folder: string };
      return { folder: input.folder };
    }
    case "assets.setScope":
      return { input: args };
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
    case "folders.create": {
      const input = args as FolderCreateInput;
      return { parent: input.parent, name: input.name };
    }
    case "folders.rename": {
      const input = args as FolderRenameInput;
      return { oldPath: input.oldPath, newName: input.newName };
    }
    case "folders.move": {
      const input = args as FolderMoveInput;
      return { srcPath: input.srcPath, destParent: input.destParent };
    }
    case "notes.move": {
      const input = args as MoveNoteInput;
      return { notePath: input.notePath, destFolder: input.destFolder };
    }
    case "notes.bulkMove":
    case "notes.bulkTrash":
    case "notes.bulkSetFrontmatter":
      return args as RustArgs;
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
