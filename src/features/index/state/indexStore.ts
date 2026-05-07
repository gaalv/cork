import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import type {
  IndexProgressEvent,
  IndexStatus,
  LinkRow,
  SearchResult,
  TagCount,
} from "@/shared/ipc/IpcContract";
import type { NoteEntry } from "@/shared/ipc/types";

type Unlisten = () => void;

type IndexStore = {
  progress: IndexProgressEvent | null;
  ready: boolean;
  status: IndexStatus | null;
  error: string | null;
  recentNotes: NoteEntry[];
  tags: TagCount[];
  startIndexIntegration: () => Promise<void>;
  stopIndexIntegration: () => void;
  refreshStatus: () => Promise<void>;
  loadHomeIndex: () => Promise<void>;
  allPaged: (offset: number, limit: number) => Promise<NoteEntry[]>;
  recent: (limit?: number) => Promise<NoteEntry[]>;
  byTag: (tag: string) => Promise<NoteEntry[]>;
  byFolder: (folder: string) => Promise<NoteEntry[]>;
  byId: (id: string) => Promise<NoteEntry | null>;
  tagsList: () => Promise<TagCount[]>;
  outgoingLinks: (noteId: string) => Promise<LinkRow[]>;
  incomingLinks: (noteId: string) => Promise<LinkRow[]>;
  search: (query: string, limit?: number) => Promise<SearchResult[]>;
  rebuild: () => Promise<void>;
};

let unlisteners: Unlisten[] = [];

export const useIndexStore = create<IndexStore>((set, get) => ({
  progress: null,
  ready: false,
  status: null,
  error: null,
  recentNotes: [],
  tags: [],

  async startIndexIntegration() {
    if (unlisteners.length > 0) {
      return;
    }
    const progressUnlisten = await client.events.on("index:progress", (progress) => {
      set({ progress, error: null });
    });
    const readyUnlisten = await client.events.on("index:ready", (status) => {
      set({ ready: status.ready, status, error: null });
      void get().loadHomeIndex();
    });
    const errorUnlisten = await client.events.on("index:error", (event) => {
      set({ error: event.message });
    });
    unlisteners = [progressUnlisten, readyUnlisten, errorUnlisten];
    await get().refreshStatus();
  },

  stopIndexIntegration() {
    for (const unlisten of unlisteners) {
      unlisten();
    }
    unlisteners = [];
  },

  async refreshStatus() {
    try {
      const status = await client.index.status();
      set({ ready: status.ready, status, error: null });
      if (status.ready) {
        await get().loadHomeIndex();
      }
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  async loadHomeIndex() {
    try {
      const [recentNotes, tags] = await Promise.all([client.notes.recent(20), client.tags.list()]);
      set({ recentNotes, tags, error: null });
    } catch (error) {
      set({ error: errorMessage(error) });
    }
  },

  allPaged: (offset, limit) => client.notes.allPaged(offset, limit),
  recent: (limit) => client.notes.recent(limit),
  byTag: (tag) => client.notes.byTag(tag),
  byFolder: (folder) => client.notes.byFolder(folder),
  byId: (id) => client.notes.byId(id),
  tagsList: () => client.tags.list(),
  outgoingLinks: (noteId) => client.links.outgoing(noteId),
  incomingLinks: (noteId) => client.links.incoming(noteId),
  search: (query, limit) => client.index.search(query, limit),

  async rebuild() {
    set({ ready: false, progress: { processed: 0, total: 0, phase: "building" }, error: null });
    await client.index.rebuild();
  },
}));

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unknown index error";
}
