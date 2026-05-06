import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { Editor } from "@/features/editor/ui/Editor";

import { createSearchExtension, searchExtension } from "./searchExtension";

describe("searchExtension", () => {
  beforeEach(() => {
    useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
  });

  it("opens the in-note search panel", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "find me", extensions: [createSearchExtension()] }) });

    expect(openSearchPanel(view)).toBe(true);
    expect(parent.querySelector(".cm-search")).toBeInTheDocument();
    view.destroy();
  });

  it("opens the search panel from the editor Mod+F shortcut", () => {
    useEditorStore.getState().openBuffer({ noteId: "n1", file: { path: "note.md", frontmatter: {}, body: "Find this text", mtime: 1 } });
    let view: EditorView | undefined;
    render(<Editor onReady={(readyView) => { view = readyView; }} />);
    if (!view) {
      throw new Error("EditorView was not created");
    }

    const editor = screen.getByTestId("editor");
    const content = view.contentDOM;
    content.focus();
    content.dispatchEvent(new KeyboardEvent("keydown", { key: "f", code: "KeyF", ctrlKey: true, metaKey: true, bubbles: true, cancelable: true }));

    expect(editor.querySelector(".cm-search")).toBeInTheDocument();
  });

  it("keeps a reusable extension export", () => {
    expect(searchExtension).toBeDefined();
  });
});
