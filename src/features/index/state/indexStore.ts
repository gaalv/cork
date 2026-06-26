/**
 * Index store — manages the SQLite full-text index lifecycle.
 *
 * Single source of truth for all index-derived data: tags,
 * pinned IDs, and the note→tag map. Subscribes to the `index:updated`
 * event emitted by the Rust indexer after it finishes processing, so
 * all consumers get fresh data without manual refresh calls or timeouts.
 *
 * All mutations follow the optimistic pattern:
 * 1. Snapshot previous state
 * 2. Apply optimistic update synchronously
 * 3. Persist via IPC async
 * 4. On error: rollback to snapshot and re-throw
 *
 * @see ARCHITECTURE.md — Indexer Reactivity
 * @see CONVENTIONS.md — Optimistic Mutations
 */

import { create } from "zustand";

import { client } from "@/shared/ipc/client";
import type { NoteEntry } from "@/shared/ipc/types";

type TagCount = { tag: string; count: number };
type NoteTagPair = { noteId: string; tag: string };
type PendingTagOp = { noteId: string; tag: string; op: "add" | "remove"; at: number };

/** How long (ms) to keep replaying optimistic tag ops over backend data. */
const PENDING_TAG_TTL = 5_000;

type IndexState = {
  ready: boolean;
  error: string | null;
  tags: TagCount[];
  noteTagMap: Map<string, string[]>;
  pinnedIds: Set<string>;
  startIndexIntegration: () => Promise<void>;
  refreshIndex: () => Promise<void>;

  // — Mutations (optimistic → persist → rollback on error) —
  toggleNotePin: (noteId: string, path: string) => Promise<void>;
  addTagToNote: (noteId: string, tag: string) => void;
  removeTagFromNote: (noteId: string, tag: string) => void;
  createTag: (tag: string) => Promise<void>;
  renameTag: (oldTag: string, newTag: string) => Promise<void>;
  deleteTag: (tag: string) => Promise<void>;
  search: (query: string, limit?: number) => Promise<NoteEntry[]>;
};

/**
 * Pending optimistic tag ops — lives outside the store to avoid
 * triggering re-renders. Replayed by refreshIndex until the backend
 * catches up or the TTL expires.
 */
let pendingTagOps: PendingTagOp[] = [];

export const useIndexStore = create<IndexState>((set, get) => ({
  ready: false,
  error: null,
  tags: [],
  noteTagMap: new Map(),
  pinnedIds: new Set(),

  startIndexIntegration: async () => {
    try {
      await client.index.status();

      const [tagsResult, noteTagResult, pinnedResult] = await Promise.all([
        client.tags.list().catch(() => [] as TagCount[]),
        client.tags.noteMap().catch(() => [] as NoteTagPair[]),
        client.notes.pinned().catch(() => [] as NoteEntry[]),
      ]);

      set({
        ready: true,
        error: null,
        tags: tagsResult as TagCount[],
        noteTagMap: buildNoteTagMap(noteTagResult as NoteTagPair[]),
        pinnedIds: new Set((pinnedResult as NoteEntry[]).map((n) => n.id)),
      });

      // Subscribe to index:updated — fires AFTER the Rust indexer has
      // processed a change, so queries return fresh data immediately.
      void client.events.on("index:updated", () => {
        void get().refreshIndex();
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshIndex: async () => {
    try {
      const [tagsResult, noteTagResult, pinnedResult] = await Promise.all([
        client.tags.list().catch(() => [] as TagCount[]),
        client.tags.noteMap().catch(() => [] as NoteTagPair[]),
        client.notes.pinned().catch(() => [] as NoteEntry[]),
      ]);

      let tags = tagsResult as TagCount[];
      const noteTagMap = buildNoteTagMap(noteTagResult as NoteTagPair[]);

      // Replay pending optimistic tag ops that the backend hasn't
      // caught up with yet, then prune expired entries.
      const now = Date.now();
      pendingTagOps = pendingTagOps.filter((op) => now - op.at < PENDING_TAG_TTL);

      for (const op of pendingTagOps) {
        const noteTags = noteTagMap.get(op.noteId) ?? [];

        if (op.op === "add") {
          // If the backend already reflects this op, drop it
          if (noteTags.includes(op.tag)) continue;
          noteTags.push(op.tag);
          noteTagMap.set(op.noteId, noteTags);
          const existing = tags.find((t) => t.tag === op.tag);
          if (existing) existing.count += 1;
          else tags = [...tags, { tag: op.tag, count: 1 }];
        } else {
          // remove
          if (!noteTags.includes(op.tag)) continue;
          const filtered = noteTags.filter((t) => t !== op.tag);
          if (filtered.length > 0) noteTagMap.set(op.noteId, filtered);
          else noteTagMap.delete(op.noteId);
          tags = tags
            .map((t) => (t.tag === op.tag ? { ...t, count: t.count - 1 } : t))
            .filter((t) => t.count > 0);
        }
      }

      set({
        tags,
        noteTagMap,
        pinnedIds: new Set((pinnedResult as NoteEntry[]).map((n) => n.id)),
      });
    } catch {
      // silently fail — stale data is acceptable briefly
    }
  },

  // — Pin toggle: optimistic → persist → rollback —
  toggleNotePin: async (noteId, path) => {
    const prev = new Set(get().pinnedIds);
    const isPinned = prev.has(noteId);

    // 1. Optimistic update
    set(() => {
      const next = new Set(prev);
      if (isPinned) next.delete(noteId);
      else next.add(noteId);
      return { pinnedIds: next };
    });

    // 2. Persist
    try {
      await client.notes.bulkSetFrontmatter([path], {
        pinned: isPinned ? null : true,
      });
    } catch (err) {
      // 3. Rollback
      set({ pinnedIds: prev });
      throw err;
    }
  },

  // — Tag on note: optimistic only (persistence via editorStore auto-save) —
  addTagToNote: (noteId, tag) => {
    pendingTagOps.push({ noteId, tag, op: "add", at: Date.now() });
    set((state) => {
      const nextMap = new Map(state.noteTagMap);
      const noteTags = [...(nextMap.get(noteId) ?? [])];
      if (!noteTags.includes(tag)) noteTags.push(tag);
      nextMap.set(noteId, noteTags);

      const nextTags = [...state.tags];
      const existing = nextTags.find((t) => t.tag === tag);
      if (existing) existing.count += 1;
      else nextTags.push({ tag, count: 1 });

      return { noteTagMap: nextMap, tags: nextTags };
    });
  },

  removeTagFromNote: (noteId, tag) => {
    pendingTagOps.push({ noteId, tag, op: "remove", at: Date.now() });
    set((state) => {
      const nextMap = new Map(state.noteTagMap);
      const noteTags = (nextMap.get(noteId) ?? []).filter((t) => t !== tag);
      if (noteTags.length > 0) nextMap.set(noteId, noteTags);
      else nextMap.delete(noteId);

      const nextTags = state.tags
        .map((t) => (t.tag === tag ? { ...t, count: t.count - 1 } : t))
        .filter((t) => t.count > 0);

      return { noteTagMap: nextMap, tags: nextTags };
    });
  },

  // — Tag CRUD: optimistic → persist → rollback —
  createTag: async (tag) => {
    const prevTags = [...get().tags];

    set((state) => ({
      tags: [...state.tags, { tag, count: 0 }],
    }));

    try {
      await client.tags.create(tag);
    } catch (err) {
      set({ tags: prevTags });
      throw err;
    }
  },

  renameTag: async (oldTag, newTag) => {
    const prevTags = [...get().tags];
    const prevMap = new Map(get().noteTagMap);

    // 1. Optimistic: rename in tags list and noteTagMap
    set((state) => {
      const nextTags = state.tags.map((t) =>
        t.tag === oldTag ? { ...t, tag: newTag } : t,
      );
      const nextMap = new Map<string, string[]>();
      for (const [noteId, noteTags] of state.noteTagMap) {
        nextMap.set(
          noteId,
          noteTags.map((t) => (t === oldTag ? newTag : t)),
        );
      }
      return { tags: nextTags, noteTagMap: nextMap };
    });

    // 2. Persist
    try {
      await client.tags.rename(oldTag, newTag);
    } catch (err) {
      set({ tags: prevTags, noteTagMap: prevMap });
      throw err;
    }
  },

  deleteTag: async (tag) => {
    const prevTags = [...get().tags];
    const prevMap = new Map(get().noteTagMap);

    // 1. Optimistic: remove from tags list and noteTagMap
    set((state) => {
      const nextTags = state.tags.filter((t) => t.tag !== tag);
      const nextMap = new Map<string, string[]>();
      for (const [noteId, noteTags] of state.noteTagMap) {
        const filtered = noteTags.filter((t) => t !== tag);
        if (filtered.length > 0) nextMap.set(noteId, filtered);
      }
      return { tags: nextTags, noteTagMap: nextMap };
    });

    // 2. Persist
    try {
      await client.tags.delete(tag);
    } catch (err) {
      set({ tags: prevTags, noteTagMap: prevMap });
      throw err;
    }
  },

  search: async (query, limit) => {
    const results = await client.index.search(query, limit);
    return results as NoteEntry[];
  },
}));

function buildNoteTagMap(pairs: NoteTagPair[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const { noteId, tag } of pairs) {
    const existing = map.get(noteId);
    if (existing) existing.push(tag);
    else map.set(noteId, [tag]);
  }
  return map;
}
