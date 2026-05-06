import { useEffect } from "react";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { client } from "@/shared/ipc/client";

import type { EditorBuffer } from "@/features/editor/state/editorStore";

type TimerHandle = number;

const DEBOUNCE_MS = 500;
const timers = new Map<string, TimerHandle>();
const inFlight = new Set<string>();

export function useAutoSave() {
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      for (const buffer of state.buffers.values()) {
        if (!buffer.dirty || buffer.conflict) {
          continue;
        }
        if (inFlight.has(buffer.noteId)) {
          continue;
        }
        if (buffer.saveStatus !== "saving") {
          scheduleSave(buffer.noteId);
        }
      }
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
      inFlight.clear();
    };
  }, []);
}

export function flushEditorSave(noteId: string): Promise<void> {
  const timer = timers.get(noteId);
  if (timer) {
    window.clearTimeout(timer);
    timers.delete(noteId);
  }
  return saveNow(noteId);
}

function scheduleSave(noteId: string) {
  const existing = timers.get(noteId);
  if (existing) {
    window.clearTimeout(existing);
  }
  timers.set(
    noteId,
    window.setTimeout(() => {
      timers.delete(noteId);
      void saveNow(noteId);
    }, DEBOUNCE_MS),
  );
}

async function saveNow(noteId: string): Promise<void> {
  const buffer = useEditorStore.getState().buffers.get(noteId);
  if (!buffer || !buffer.dirty || buffer.conflict) {
    return;
  }

  if (inFlight.has(noteId)) {
    useEditorStore.getState().setPendingSave(noteId, true);
    return;
  }

  inFlight.add(noteId);
  useEditorStore.getState().markSaving(noteId);
  try {
    const result = await client.notes.save(saveInput(buffer));
    useEditorStore.getState().markSaved(noteId, result);
  } catch (error) {
    if (isConflict(error)) {
      useEditorStore.getState().setConflict(noteId, {
        externalMtime: error.currentMtime ?? buffer.loadedMtime,
        message: error.message,
      });
    } else {
      useEditorStore.getState().markSaveError(noteId, errorMessage(error));
    }
  } finally {
    inFlight.delete(noteId);
    const latest = useEditorStore.getState().buffers.get(noteId);
    if (latest?.pendingSave && latest.dirty && !latest.conflict) {
      useEditorStore.getState().setPendingSave(noteId, false);
      scheduleSave(noteId);
    }
  }
}

function saveInput(buffer: EditorBuffer) {
  return {
    path: buffer.path,
    frontmatter: buffer.frontmatter,
    body: buffer.body,
    expectedMtime: buffer.loadedMtime,
  };
}

function isConflict(error: unknown): error is { kind: "Conflict"; message?: string; currentMtime?: number } {
  return typeof error === "object" && error !== null && "kind" in error && error.kind === "Conflict";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unable to save note";
}
