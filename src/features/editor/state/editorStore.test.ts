import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "./editorStore";

import type { NoteFile } from "@/shared/ipc/types";

const file: NoteFile = {
  path: "notes/hello.md",
  frontmatter: {},
  body: "Hello",
  mtime: 10,
};

beforeEach(() => {
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
});

describe("editorStore", () => {
  it("loads and activates a note buffer", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file });

    const state = useEditorStore.getState();
    expect(state.activeNoteId).toBe("n1");
    expect(state.buffers.get("n1")?.body).toBe("Hello");
    expect(state.buffers.get("n1")?.dirty).toBe(false);
  });

  it("marks a buffer dirty when edited", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file });
    useEditorStore.getState().updateBody("n1", "Hello world");

    const buffer = useEditorStore.getState().buffers.get("n1");
    expect(buffer?.body).toBe("Hello world");
    expect(buffer?.dirty).toBe(true);
  });

  it("updates mtime and clears dirty state after save", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file });
    useEditorStore.getState().updateBody("n1", "Hello world");
    useEditorStore.getState().markSaved("n1", { path: file.path, mtime: 20 }, 1234);

    const buffer = useEditorStore.getState().buffers.get("n1");
    expect(buffer?.loadedMtime).toBe(20);
    expect(buffer?.lastSavedAt).toBe(1234);
    expect(buffer?.dirty).toBe(false);
    expect(buffer?.saveStatus).toBe("saved");
  });

  it("records and resolves conflicts", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file });
    useEditorStore.getState().setConflict("n1", { externalMtime: 30 });

    expect(useEditorStore.getState().buffers.get("n1")?.conflict).toEqual({ externalMtime: 30 });

    useEditorStore.getState().resolveConflict("n1", "reload", { ...file, body: "Disk", mtime: 30 });

    const buffer = useEditorStore.getState().buffers.get("n1");
    expect(buffer?.body).toBe("Disk");
    expect(buffer?.dirty).toBe(false);
    expect(buffer?.conflict).toBeNull();
  });
});
