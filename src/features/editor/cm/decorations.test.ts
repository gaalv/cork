import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { concealedBrackets } from "./concealedBrackets";
import { headingSizes } from "./headingSizes";

describe("editor decorations", () => {
  it("applies heading line classes", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "# Title", extensions: [headingSizes] }) });

    expect(parent.querySelector(".cm-heading-1")).toBeInTheDocument();
    view.destroy();
  });

  it("conceals wikilink brackets until cursor enters", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "See [[Note]]", extensions: [concealedBrackets] }) });

    expect(parent.querySelectorAll(".cm-wikilink-bracket-hidden")).toHaveLength(2);
    view.dispatch({ selection: { anchor: 7 } });
    expect(parent.querySelectorAll(".cm-wikilink-bracket-hidden")).toHaveLength(0);
    view.destroy();
  });
});
