import { create } from "zustand";

import { client } from "@/shared/ipc/client";

import type { JsonRecord, NoteFile, SaveInput, SaveResult } from "@/shared/ipc/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type EditorConflict = {
  externalMtime: number;
  message?: string;
};

export type EditorBuffer = {
  noteId: string;
  path: string;
  frontmatter: JsonRecord;
  body: string;
  loadedMtime: number;
  dirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  pendingSave: boolean;
  conflict: EditorConflict | null;
};

type OpenBufferInput = {
  noteId: string;
  file: NoteFile;
};

type EditorStore = {
  activeNoteId: string | null;
  buffers: Map<string, EditorBuffer>;
  openBuffer: (input: OpenBufferInput) => void;
  setActiveNoteId: (noteId: string | null) => void;
  updateBody: (noteId: string, body: string) => void;
  updateFrontmatter: (noteId: string, patch: JsonRecord) => void;
  markSaving: (noteId: string) => void;
  markSaved: (noteId: string, result: SaveResult, savedAt?: number) => void;
  markSaveError: (noteId: string, message: string) => void;
  setPendingSave: (noteId: string, pendingSave: boolean) => void;
  setConflict: (noteId: string, conflict: EditorConflict) => void;
  resolveConflict: (noteId: string, strategy: "reload" | "keep", file?: NoteFile) => void;
  replaceFromDisk: (noteId: string, file: NoteFile) => void;
  flushAll: () => Promise<void>;
};

export const useEditorStore = create<EditorStore>((set) => ({
  activeNoteId: null,
  buffers: new Map(),

  openBuffer({ noteId, file }) {
    set((state) => {
      const buffers = cloneBuffers(state.buffers);
      buffers.set(noteId, createBuffer(noteId, file));
      return { activeNoteId: noteId, buffers };
    });
  },

  setActiveNoteId(noteId) {
    set({ activeNoteId: noteId });
  },

  updateBody(noteId, body) {
    updateBuffer(set, noteId, (buffer) => ({
      ...buffer,
      body,
      dirty: body !== buffer.body ? true : buffer.dirty,
      pendingSave: body !== buffer.body && buffer.saveStatus === "saving" ? true : buffer.pendingSave,
      saveStatus: body !== buffer.body && buffer.saveStatus !== "saving" ? "idle" : buffer.saveStatus,
    }));
  },

  updateFrontmatter(noteId, patch) {
    updateBuffer(set, noteId, (buffer) => {
      const next = { ...buffer.frontmatter, ...patch };
      const changed = JSON.stringify(next) !== JSON.stringify(buffer.frontmatter);
      if (!changed) {
        return buffer;
      }
      return {
        ...buffer,
        frontmatter: next,
        dirty: true,
        pendingSave: buffer.saveStatus === "saving" ? true : buffer.pendingSave,
        saveStatus: buffer.saveStatus !== "saving" ? "idle" : buffer.saveStatus,
      };
    });
  },

  markSaving(noteId) {
    updateBuffer(set, noteId, (buffer) => ({ ...buffer, saveStatus: "saving", saveError: null }));
  },

  markSaved(noteId, result, savedAt = Date.now()) {
    updateBuffer(set, noteId, (buffer) => ({
      ...buffer,
      path: result.path,
      loadedMtime: result.mtime,
      dirty: buffer.pendingSave,
      pendingSave: buffer.pendingSave,
      saveStatus: "saved",
      saveError: null,
      lastSavedAt: savedAt,
      conflict: null,
    }));
  },

  markSaveError(noteId, message) {
    updateBuffer(set, noteId, (buffer) => ({ ...buffer, saveStatus: "error", saveError: message }));
  },

  setPendingSave(noteId, pendingSave) {
    updateBuffer(set, noteId, (buffer) => ({ ...buffer, pendingSave }));
  },

  setConflict(noteId, conflict) {
    updateBuffer(set, noteId, (buffer) => ({ ...buffer, conflict, saveStatus: "error" }));
  },

  resolveConflict(noteId, strategy, file) {
    if (strategy === "reload" && file) {
      updateBuffer(set, noteId, () => createBuffer(noteId, file));
      return;
    }
    updateBuffer(set, noteId, (buffer) => ({ ...buffer, conflict: null, saveStatus: "idle" }));
  },

  replaceFromDisk(noteId, file) {
    updateBuffer(set, noteId, () => createBuffer(noteId, file));
  },

  async flushAll() {
    const dirtyBuffers = [...useEditorStore.getState().buffers.values()].filter(
      (buffer) => buffer.dirty && !buffer.conflict,
    );
    await Promise.all(dirtyBuffers.map((buffer) => flushBuffer(buffer.noteId)));
  },
}));

function createBuffer(noteId: string, file: NoteFile): EditorBuffer {
  return {
    noteId,
    path: file.path,
    frontmatter: file.frontmatter,
    body: file.body,
    loadedMtime: file.mtime,
    dirty: false,
    saveStatus: "idle",
    saveError: null,
    lastSavedAt: null,
    pendingSave: false,
    conflict: null,
  };
}

function cloneBuffers(buffers: Map<string, EditorBuffer>) {
  return new Map(buffers);
}

async function flushBuffer(noteId: string): Promise<void> {
  const buffer = useEditorStore.getState().buffers.get(noteId);
  if (!buffer || !buffer.dirty || buffer.conflict) {
    return;
  }
  useEditorStore.getState().markSaving(noteId);
  try {
    useEditorStore.getState().setPendingSave(noteId, false);
    const result = await client.notes.save(saveInput(buffer));
    useEditorStore.getState().markSaved(noteId, result);
  } catch (error) {
    useEditorStore.getState().markSaveError(noteId, errorMessage(error));
    throw error;
  }
}

function saveInput(buffer: EditorBuffer): SaveInput {
  return {
    path: buffer.path,
    frontmatter: buffer.frontmatter,
    body: buffer.body,
    expectedMtime: buffer.loadedMtime,
  };
}

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
  return "Unable to save note";
}

type SetEditorState = (updater: (state: EditorStore) => Partial<EditorStore>) => void;

function updateBuffer(
  set: SetEditorState,
  noteId: string,
  updater: (buffer: EditorBuffer) => EditorBuffer,
) {
  set((state) => {
    const current = state.buffers.get(noteId);
    if (!current) {
      return state;
    }
    const buffers = cloneBuffers(state.buffers);
    buffers.set(noteId, updater(current));
    return { buffers };
  });
}
