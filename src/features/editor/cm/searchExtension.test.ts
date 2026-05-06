import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { describe, expect, it } from "vitest";

import { searchExtension } from "./searchExtension";

describe("searchExtension", () => {
  it("opens the in-note search panel", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "find me", extensions: [searchExtension] }) });

    expect(openSearchPanel(view)).toBe(true);
    expect(parent.querySelector(".cm-search")).toBeInTheDocument();
    view.destroy();
  });
});
