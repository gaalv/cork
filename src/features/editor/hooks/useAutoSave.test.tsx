import { act } from "react";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { useAutoSave } from "./useAutoSave";

import type { NoteFile, SaveInput, SaveResult } from "@/shared/ipc/types";

const saveMock = vi.fn<(input: SaveInput) => Promise<SaveResult>>();

vi.mock("@/shared/ipc/client", () => ({
  client: {
    notes: {
      save: (input: SaveInput) => saveMock(input),
    },
  },
}));

const note: NoteFile = {
  path: "note.md",
  frontmatter: {},
  body: "Initial",
  mtime: 1,
};

function AutoSaveHarness() {
  useAutoSave();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  saveMock.mockReset();
  saveMock.mockResolvedValue({ path: "note.md", mtime: 2 });
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutoSave", () => {
  it("debounces dirty buffers for 500ms", async () => {
    render(<AutoSaveHarness />);
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });
    useEditorStore.getState().updateBody("n1", "Changed");

    expect(saveMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(saveMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(saveMock).toHaveBeenCalledWith({
      path: "note.md",
      frontmatter: {},
      body: "Changed",
      expectedMtime: 1,
    });
    expect(useEditorStore.getState().buffers.get("n1")?.dirty).toBe(false);
  });

  it("queues a follow-up save while one is in flight", async () => {
    let resolveSave: ((result: SaveResult) => void) | undefined;
    saveMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<AutoSaveHarness />);
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });
    useEditorStore.getState().updateBody("n1", "First");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    useEditorStore.getState().updateBody("n1", "Second");

    expect(useEditorStore.getState().buffers.get("n1")?.pendingSave).toBe(true);
    resolveSave?.({ path: "note.md", mtime: 2 });
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(saveMock.mock.calls[1]?.[0].body).toBe("Second");
  });

  it("pauses saving and records conflicts", async () => {
    saveMock.mockRejectedValueOnce({ kind: "Conflict", message: "changed", currentMtime: 9 });
    render(<AutoSaveHarness />);
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });
    useEditorStore.getState().updateBody("n1", "Changed");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(useEditorStore.getState().buffers.get("n1")?.conflict).toEqual({
      externalMtime: 9,
      message: "changed",
    });
  });
});
