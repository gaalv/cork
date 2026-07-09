/**
 * Editor buffer store — manages the active note buffer, auto-save,
 * and conflict detection with external changes.
 *
 * @see F05 — Editor spec
 */

import { create } from "zustand";

import { client } from "@/ipc/client";
import type { IpcErrorPayload, JsonRecord } from "@/ipc/types";
import { useAppSettingsStore } from "@/stores/appSettingsStore";
import { useVaultStore } from "@/stores/vaultStore";

type Conflict = {
  externalMtime: number;
};

type EditorState = {
  // Buffer state
  noteId: string | null;
  path: string | null;
  body: string;
  frontmatter: JsonRecord;
  loadedMtime: number;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
  conflict: Conflict | null;
  loading: boolean;
  error: string | null;
  /** One-shot caret target (UTF-16 offset) consumed by the editor on mount —
   *  set by createNoteFromTemplate, cleared after the first consume. */
  pendingCursorOffset: number | null;

  // Actions
  openBuffer: (noteId: string, path: string) => Promise<void>;
  setPendingCursorOffset: (offset: number | null) => void;
  updateBody: (body: string) => void;
  updateFrontmatter: (frontmatter: JsonRecord) => void;
  save: () => Promise<void>;
  syncExternalFrontmatter: (noteId: string, patch: JsonRecord) => Promise<void>;
  setPath: (path: string) => void;
  forceReload: () => Promise<void>;
  forceSave: () => Promise<void>;
  closeBuffer: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlightSave: Promise<void> | null = null;
  let pendingSave = false;

  function clearSaveTimer() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function getDebounceMs(): number {
    return useAppSettingsStore.getState().settings.editor.autoSaveDebounceMs;
  }

  async function doSave() {
    const { path, body, frontmatter, loadedMtime, dirty } = get();
    if (!path || !dirty) return;

    if (inFlightSave) {
      pendingSave = true;
      return;
    }

    set({ saving: true });

    inFlightSave = (async () => {
      try {
        const saved = await client.notes.save({
          path,
          body,
          frontmatter,
          expectedMtime: loadedMtime,
        });
        set({
          dirty: false,
          saving: false,
          loadedMtime: saved.mtime,
          lastSavedAt: Date.now(),
        });

        // Refresh note list immediately (file is already on disk).
        // Index-derived data (tags, counts, pinned) refreshes automatically
        // via the index:updated event emitted after the Rust indexer processes.
        void useVaultStore.getState().loadNotes();
      } catch (err) {
        const error = err as IpcErrorPayload;
        if (error.kind === "Conflict" && error.currentMtime) {
          set({
            saving: false,
            conflict: { externalMtime: error.currentMtime },
          });
        } else {
          set({ saving: false, error: String(err) });
        }
      } finally {
        inFlightSave = null;
        if (pendingSave) {
          pendingSave = false;
          void doSave();
        }
      }
    })();

    await inFlightSave;
  }

  return {
    noteId: null,
    path: null,
    body: "",
    frontmatter: {},
    loadedMtime: 0,
    dirty: false,
    saving: false,
    lastSavedAt: null,
    conflict: null,
    loading: false,
    error: null,
    pendingCursorOffset: null,

    setPendingCursorOffset: (pendingCursorOffset) => set({ pendingCursorOffset }),

    openBuffer: async (noteId, path) => {
      // Flush pending saves before switching
      clearSaveTimer();
      if (get().dirty && get().path) {
        await doSave();
      }

      set({
        noteId,
        path,
        body: "",
        frontmatter: {},
        loadedMtime: 0,
        dirty: false,
        saving: false,
        lastSavedAt: null,
        conflict: null,
        loading: true,
        error: null,
      });

      try {
        const note = await client.notes.read(path);
        set({
          body: note.body,
          frontmatter: note.frontmatter,
          loadedMtime: note.mtime,
          loading: false,
        });
      } catch (err) {
        set({ loading: false, error: String(err) });
      }
    },

    updateBody: (body) => {
      set({ body, dirty: true, conflict: null });

      // Schedule auto-save
      clearSaveTimer();
      saveTimer = setTimeout(() => {
        void doSave();
      }, getDebounceMs());
    },

    updateFrontmatter: (frontmatter) => {
      set({ frontmatter, dirty: true });
      clearSaveTimer();
      saveTimer = setTimeout(() => {
        void doSave();
      }, getDebounceMs());
    },

    save: async () => {
      clearSaveTimer();
      await doSave();
    },

    // Reconcile the open buffer after an out-of-band frontmatter write
    // (e.g. pin/status via notes.bulkSetFrontmatter). Merges the patch into
    // the in-memory frontmatter (null deletes the key) WITHOUT touching the
    // body or the dirty flag — unsaved edits survive — and refreshes
    // loadedMtime from disk so the next auto-save doesn't false-conflict.
    syncExternalFrontmatter: async (noteId, patch) => {
      const { noteId: openId, path } = get();
      if (openId !== noteId || !path) return;

      const frontmatter = { ...get().frontmatter };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete frontmatter[key];
        else frontmatter[key] = value;
      }

      let loadedMtime = get().loadedMtime;
      try {
        const onDisk = await client.notes.read(path);
        loadedMtime = onDisk.mtime;
      } catch {
        // keep the previous mtime — worst case is a conflict prompt
      }

      // Bail if the buffer switched notes while we were reading.
      if (get().noteId !== noteId) return;
      set({ frontmatter, loadedMtime });
    },

    setPath: (path) => {
      set({ path });
    },

    forceReload: async () => {
      const { path, noteId } = get();
      if (!path || !noteId) return;
      set({ conflict: null, dirty: false });
      await get().openBuffer(noteId, path);
    },

    forceSave: async () => {
      const { path, body, frontmatter } = get();
      if (!path) return;

      set({ saving: true, conflict: null });
      try {
        const saved = await client.notes.save({ path, body, frontmatter });
        set({
          dirty: false,
          saving: false,
          loadedMtime: saved.mtime,
          lastSavedAt: Date.now(),
        });
        void useVaultStore.getState().loadNotes();
      } catch (err) {
        set({ saving: false, error: String(err) });
      }
    },

    closeBuffer: () => {
      clearSaveTimer();
      if (get().dirty && get().path) {
        void doSave();
      }
      set({
        noteId: null,
        path: null,
        body: "",
        frontmatter: {},
        loadedMtime: 0,
        dirty: false,
        saving: false,
        lastSavedAt: null,
        conflict: null,
        loading: false,
        error: null,
      });
    },
  };
});
