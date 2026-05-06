import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { Editor } from "./Editor";

import type { EditorView } from "@codemirror/view";
import type { NoteFile } from "@/shared/ipc/types";

const note: NoteFile = {
  path: "note.md",
  frontmatter: {},
  body: "Initial",
  mtime: 1,
};

beforeEach(() => {
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
});

describe("Editor", () => {
  it("mounts CodeMirror with the active buffer", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });

    render(<Editor />);

    expect(screen.getByTestId("editor").querySelector(".cm-editor")).toBeInTheDocument();
    expect(screen.getByText("Initial")).toBeInTheDocument();
  });

  it("updates the store when text is typed", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file: note });
    let view: EditorView | undefined;

    render(<Editor onReady={(readyView) => { view = readyView; }} />);
    if (!view) {
      throw new Error("EditorView was not created");
    }
    view.dispatch({ changes: { from: 7, insert: " body" } });

    expect(useEditorStore.getState().buffers.get("n1")?.body).toBe("Initial body");
    expect(useEditorStore.getState().buffers.get("n1")?.dirty).toBe(true);
  });
});
