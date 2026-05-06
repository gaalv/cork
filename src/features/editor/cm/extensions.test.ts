import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { createEditorExtensions } from "./extensions";

describe("createEditorExtensions", () => {
  it("renders a themed CodeMirror editor in jsdom", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({ doc: "# Heading\n\n[[Link]] #tag", extensions: createEditorExtensions() }),
    });

    expect(parent.querySelector(".cm-editor")).toBeInTheDocument();
    expect(parent.innerHTML).toMatchSnapshot();
    view.destroy();
  });
});
