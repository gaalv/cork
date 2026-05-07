import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { useExternalReconciler } from "./useExternalReconciler";

import type { IpcEventPayload } from "@/shared/ipc/IpcContract";
import type { NoteFile } from "@/shared/ipc/types";

type FileChanged = IpcEventPayload<"vault:fileChanged">;

let fileChanged: ((event: FileChanged) => void) | undefined;
const readMock = vi.fn<(path: string) => Promise<NoteFile>>();

vi.mock("@/shared/ipc/client", () => ({
  client: {
    events: {
      on: (_event: "vault:fileChanged", callback: (event: FileChanged) => void) => {
        fileChanged = callback;
        return Promise.resolve(() => undefined);
      },
    },
    notes: {
      read: (path: string) => readMock(path),
    },
  },
}));

const note: NoteFile = { path: "note.md", frontmatter: {}, body: "Initial", mtime: 1 };

function Harness() {
  useExternalReconciler();
  return null;
}

beforeEach(() => {
  fileChanged = undefined;
  readMock.mockReset();
  readMock.mockResolvedValue({ ...note, body: "Disk", mtime: 2 });
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
});

describe("useExternalReconciler", () => {
  it("reloads a clean active buffer after an external change", async () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });
    render(<Harness />);
    await waitFor(() => expect(fileChanged).toBeDefined());

    await fileChanged?.({ path: "note.md", kind: "modified", source: "external", mtime: 2, size: 20 });

    expect(readMock).toHaveBeenCalledWith("note.md");
    expect(useEditorStore.getState().buffers.get("n1")?.body).toBe("Disk");
  });

  it("sets a conflict when the active buffer is dirty", async () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });
    useEditorStore.getState().updateBody("n1", "Mine");
    render(<Harness />);
    await waitFor(() => expect(fileChanged).toBeDefined());

    await fileChanged?.({ path: "note.md", kind: "modified", source: "external", mtime: 3, size: 20 });

    expect(readMock).not.toHaveBeenCalled();
    expect(useEditorStore.getState().buffers.get("n1")?.conflict).toEqual({ externalMtime: 3 });
  });
});
