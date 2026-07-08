import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { emitIpcError } from "./errors";
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
  AppSettings,
  VaultSettings,
} from "./types";

const commandNames: Record<IpcCommandName, string> = {
  health: "health",
  "vault.open": "vault_open",
  "vault.current": "vault_current",
  "vault.list": "vault_list",
  "vault.watcherStart": "vault_watcher_start",
  "vault.watcherStop": "vault_watcher_stop",
  "vault.close": "vault_close",
  "vault.recent": "vault_recent",
  "vault.removeRecent": "vault_remove_recent",
  "vault.settings": "vault_settings",
  "vault.scaffoldIfNeeded": "vault_scaffold_if_needed",
  "settings.appLoad": "settings_app_load",
  "settings.appSave": "settings_app_save",
  "settings.vaultLoad": "settings_vault_load",
  "settings.vaultSave": "settings_vault_save",
  "assets.setScope": "assets_set_scope",
  "assets.writeAttachment": "assets_write_attachment",
  "folders.create": "folders_create",
  "folders.rename": "folders_rename",
  "folders.move": "folders_move",
  "folders.trash": "folders_trash",
  "folders.list": "folders_list",
  "notes.read": "notes_read",
  "notes.save": "notes_save",
  "notes.create": "notes_create",
  "notes.rename": "notes_rename",
  "notes.trash": "notes_trash",
  "templates.list": "templates_list",
  "templates.render": "templates_render",
  "notes.move": "notes_move",
  "notes.bulkMove": "notes_bulk_move",
  "notes.bulkTrash": "notes_bulk_trash",
  "notes.bulkSetFrontmatter": "notes_bulk_set_frontmatter",
  "notes.allPaged": "notes_all_paged",
  "notes.byTag": "notes_by_tag",
  "notes.byFolder": "notes_by_folder",
  "notes.byId": "notes_by_id",
  "notes.pinned": "notes_pinned",
  "tags.create": "tags_create",
  "tags.list": "tags_list",
  "tags.noteMap": "tags_note_map",
  "tags.rename": "tags_rename",
  "tags.delete": "tags_delete",
  "links.outgoing": "links_outgoing",
  "links.incoming": "links_incoming",
  "links.graph": "links_graph",
  "index.search": "index_search",
  "index.status": "index_status",
  "index.rebuild": "index_rebuild",
  // === F18 VCS ===
  "vcs.status": "vcs_status",
  "vcs.history": "vcs_history",
  "vcs.restore": "vcs_restore",
  "vcs.remoteEnable": "vcs_remote_enable",
  "vcs.remoteClone": "vcs_remote_clone",
  "vcs.remoteDisable": "vcs_remote_disable",
  "vcs.remoteSyncNow": "vcs_remote_sync_now",
  "vcs.updateToken": "vcs_update_token",
  "vcs.generateDeployKey": "vcs_generate_deploy_key",
  // === F21 AI Infrastructure ===
  "ai.runSkill": "ai_run_skill",
  "ai.cacheClear": "ai_cache_clear",
  "ai.skillsReload": "ai_skills_reload",
  "ai.skillsList": "ai_skills_list",
  "ai.stats": "ai_stats",
  "ai.telemetryClear": "ai_telemetry_clear",
  "ai.providersAvailable": "ai_providers_available",
  // === Archive ===
  "archive.note": "archive_note",
  "archive.restore": "restore_note",
  "archive.list": "list_archived",
  "diagnostics.reportError": "diagnostics_report_error",
  "diagnostics.crashLogPath": "diagnostics_crash_log_path",
  "diagnostics.recent": "diagnostics_recent",
};

type RustArgs = Record<string, unknown> | undefined;

function ipcErrorKind(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const obj = err as { kind?: unknown };
    if (typeof obj.kind === "string") return obj.kind;
  }
  return undefined;
}

function ipcErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as { message?: unknown; kind?: unknown };
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.kind === "string") return obj.kind;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

export async function invokeCommand<Name extends IpcCommandName>(
  command: Name,
  args: IpcCommandArgs<Name>,
): Promise<IpcCommandResult<Name>> {
  try {
    return await invoke<IpcCommandResult<Name>>(commandNames[command], toRustArgs(command, args));
  } catch (err) {
    const message = ipcErrorMessage(err);
    const kind = ipcErrorKind(err);
    // NotFound is a control-flow signal (missing note, no recent files,
    // no pinned notes, etc.). Callers handle it explicitly — do not toast.
    if (kind !== "NotFound") {
      emitIpcError({ topic: command, message });
    }
    if (err instanceof Error) throw err;
    throw new Error(message);
  }
}

export const client = {
  health: () => invokeCommand("health", undefined),
  vault: {
    open: (path?: string) => invokeCommand("vault.open", path ? { path } : undefined),
    current: () => invokeCommand("vault.current", undefined),
    list: () => invokeCommand("vault.list", undefined),
    watcherStart: () => invokeCommand("vault.watcherStart", undefined),
    watcherStop: () => invokeCommand("vault.watcherStop", undefined),
    close: () => invokeCommand("vault.close", undefined),
    recent: () => invokeCommand("vault.recent", undefined),
    removeRecent: (path: string) => invokeCommand("vault.removeRecent", { path }),
    settings: () => invokeCommand("vault.settings", undefined),
    scaffoldIfNeeded: () => invokeCommand("vault.scaffoldIfNeeded", undefined),
  },
  settings: {
    appLoad: () => invokeCommand("settings.appLoad", undefined),
    appSave: (settings: AppSettings) => invokeCommand("settings.appSave", { settings }),
    vaultLoad: () => invokeCommand("settings.vaultLoad", undefined),
    vaultSave: (settings: VaultSettings) => invokeCommand("settings.vaultSave", { settings }),
  },
  assets: {
    setScope: (vaultRoot: string) => invokeCommand("assets.setScope", { vaultRoot }),
    writeAttachment: (input: {
      sourcePath?: string;
      bytes?: number[];
      suggestedName: string;
      vaultRelDir?: string;
    }) => invokeCommand("assets.writeAttachment", input),
  },
  folders: {
    create: (input: FolderCreateInput) => invokeCommand("folders.create", input),
    rename: (input: FolderRenameInput) => invokeCommand("folders.rename", input),
    move: (input: FolderMoveInput) => invokeCommand("folders.move", input),
    trash: (path: string) => invokeCommand("folders.trash", { path }),
    list: () => invokeCommand("folders.list", undefined),
  },
  notes: {
    read: (path: string) => invokeCommand("notes.read", { path }),
    save: (input: SaveInput) => invokeCommand("notes.save", input),
    create: (input: CreateNoteInput) => invokeCommand("notes.create", input),
    rename: (input: RenameNoteInput) => invokeCommand("notes.rename", input),
    trash: (path: string) => invokeCommand("notes.trash", { path }),
    move: (input: MoveNoteInput) => invokeCommand("notes.move", input),
    bulkMove: (paths: string[], destFolder: string) =>
      invokeCommand("notes.bulkMove", { paths, destFolder }),
    bulkTrash: (paths: string[]) => invokeCommand("notes.bulkTrash", { paths }),
    bulkSetFrontmatter: (paths: string[], patch: JsonRecord) =>
      invokeCommand("notes.bulkSetFrontmatter", { paths, patch }),
    allPaged: (offset: number, limit: number) => invokeCommand("notes.allPaged", { offset, limit }),
    byTag: (tag: string) => invokeCommand("notes.byTag", { tag }),
    byFolder: (folder: string) => invokeCommand("notes.byFolder", { folder }),
    byId: (id: string) => invokeCommand("notes.byId", { id }),
    pinned: () => invokeCommand("notes.pinned", undefined),
  },
  templates: {
    list: () => invokeCommand("templates.list", undefined),
    render: (path: string, title?: string) => invokeCommand("templates.render", { path, title }),
  },
  tags: {
    create: (tag: string) => invokeCommand("tags.create", { tag }),
    list: () => invokeCommand("tags.list", undefined),
    noteMap: () => invokeCommand("tags.noteMap", undefined),
    rename: (oldTag: string, newTag: string) => invokeCommand("tags.rename", { oldTag, newTag }),
    delete: (tag: string) => invokeCommand("tags.delete", { tag }),
  },
  links: {
    outgoing: (noteId: string) => invokeCommand("links.outgoing", { noteId }),
    incoming: (noteId: string) => invokeCommand("links.incoming", { noteId }),
    graph: () => invokeCommand("links.graph", undefined),
  },
  index: {
    search: (query: string, limit?: number) => invokeCommand("index.search", { query, limit }),
    status: () => invokeCommand("index.status", undefined),
    rebuild: () => invokeCommand("index.rebuild", undefined),
  },
  vcs: {
    status: () => invokeCommand("vcs.status", undefined),
    history: (notePath: string, limit?: number) =>
      invokeCommand("vcs.history", { notePath, limit }),
    restore: (notePath: string, sha: string) => invokeCommand("vcs.restore", { notePath, sha }),
    remoteEnable: (input?: { url?: string; token?: string }) =>
      invokeCommand("vcs.remoteEnable", input ?? { url: undefined }),
    remoteClone: (input: { url: string; token: string; parentPath?: string }) =>
      invokeCommand("vcs.remoteClone", input),
    remoteDisable: () => invokeCommand("vcs.remoteDisable", undefined),
    remoteSyncNow: () => invokeCommand("vcs.remoteSyncNow", undefined),
    updateToken: (token: string) => invokeCommand("vcs.updateToken", { token }),
    generateDeployKey: () => invokeCommand("vcs.generateDeployKey", undefined),
  },
  ai: {
    runSkill: (skillId: string, variables: Record<string, string>) =>
      invokeCommand("ai.runSkill", { skillId, variables }),
    cacheClear: (skillId?: string) => invokeCommand("ai.cacheClear", { skillId }),
    skillsReload: () => invokeCommand("ai.skillsReload", undefined),
    skillsList: () => invokeCommand("ai.skillsList", undefined),
    stats: (since?: number) => invokeCommand("ai.stats", { since }),
    telemetryClear: () => invokeCommand("ai.telemetryClear", undefined),
    providersAvailable: () => invokeCommand("ai.providersAvailable", undefined),
  },
  archive: {
    note: (path: string) => invokeCommand("archive.note", { path }),
    restore: (path: string) => invokeCommand("archive.restore", { path }),
    list: () => invokeCommand("archive.list", undefined),
  },
  diagnostics: {
    reportError: (input: {
      source: string;
      message: string;
      stack?: string;
      route?: string;
      version?: string;
    }) => invokeCommand("diagnostics.reportError", input),
    crashLogPath: () => invokeCommand("diagnostics.crashLogPath", undefined),
    recent: (limit?: number) => invokeCommand("diagnostics.recent", { limit }),
  },
  events: {
    on: <Name extends IpcEventName>(
      event: Name,
      callback: (payload: IpcEventPayload<Name>) => void,
    ) =>
      listen<IpcEventPayload<Name>>(event, ({ payload }) =>
        callback(camelize(payload) as IpcEventPayload<Name>),
      ),
  },
};

function toRustArgs<Name extends IpcCommandName>(
  command: Name,
  args: IpcCommandArgs<Name>,
): RustArgs {
  switch (command) {
    case "health":
    case "vault.current":
    case "vault.list":
    case "vault.watcherStart":
    case "vault.watcherStop":
    case "vault.close":
    case "vault.recent":
    case "vault.settings":
    case "vault.scaffoldIfNeeded":
    case "settings.appLoad":
    case "settings.vaultLoad":
    case "tags.list":
    case "tags.noteMap":
    case "index.status":
    case "index.rebuild":
    case "notes.pinned":
    case "vcs.status":
    case "vcs.remoteDisable":
    case "vcs.remoteSyncNow":
    case "vcs.generateDeployKey":
    case "folders.list":
    case "links.graph":
    case "archive.list":
    case "ai.skillsReload":
    case "ai.skillsList":
    case "ai.telemetryClear":
    case "diagnostics.crashLogPath":
    case "templates.list":
      return undefined;
    case "vault.open":
    case "vault.removeRecent":
    case "folders.trash":
    case "notes.read":
    case "notes.trash":
    case "notes.allPaged":
    case "notes.byId":
    case "links.outgoing":
    case "links.incoming":
    case "index.search":
    case "archive.note":
    case "archive.restore":
    case "templates.render":
      return args as RustArgs;
    case "vcs.history":
    case "vcs.restore":
    case "vcs.remoteEnable":
    case "vcs.remoteClone":
    case "vcs.updateToken":
      return { input: args } as RustArgs;
    case "ai.runSkill": {
      const input = args as { skillId: string; variables: Record<string, string> };
      return { input: { skillId: input.skillId, variables: input.variables } };
    }
    case "ai.cacheClear": {
      const input = args as { skillId?: string };
      return { input: { skillId: input.skillId } };
    }
    case "ai.stats": {
      const input = args as { since?: number };
      return { input: { since: input.since } };
    }
    case "tags.create":
    case "tags.delete": {
      const input = args as { tag: string };
      return { tag: input.tag };
    }
    case "tags.rename": {
      const input = args as { oldTag: string; newTag: string };
      return { oldTag: input.oldTag, newTag: input.newTag };
    }
    case "notes.byTag": {
      const input = args as { tag: string };
      return { tag: input.tag };
    }
    case "notes.byFolder": {
      const input = args as { folder: string };
      return { folder: input.folder };
    }
    case "settings.appSave":
    case "settings.vaultSave":
      return args as RustArgs;
    case "assets.setScope":
    case "assets.writeAttachment":
      return { input: args };
    case "notes.save":
      return { input: args };
    case "notes.create": {
      const input = args as CreateNoteInput;
      return { folder: input.folder, title: input.title };
    }
    case "notes.rename": {
      const input = args as RenameNoteInput;
      return { oldPath: input.oldPath, newName: input.newName, rewrite: input.rewrite };
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
    case "diagnostics.reportError":
    case "diagnostics.recent":
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
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
