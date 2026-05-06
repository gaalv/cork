import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { calloutHintExtension } from "./calloutHint";
import { concealedBrackets } from "./concealedBrackets";
import { footnoteDefExtension } from "./footnoteDef";
import { headingSizes } from "./headingSizes";
import { highlightMarkExtension } from "./highlightMark";

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

  it("decorates callout marker lines", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "> [!note] Title\n> Body", extensions: [calloutHintExtension] }) });

    expect(parent.querySelector(".cm-callout-line")).toBeInTheDocument();
    view.destroy();
  });

  it("decorates footnote references and definitions", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "Text[^1]\n\n[^1]: Note", extensions: [footnoteDefExtension] }) });

    expect(parent.querySelector(".cm-footnote-ref")).toBeInTheDocument();
    expect(parent.querySelector(".cm-footnote-def")).toBeInTheDocument();
    view.destroy();
  });

  it("decorates highlight markers", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({ parent, state: EditorState.create({ doc: "This is ==important==", extensions: [highlightMarkExtension] }) });

    expect(parent.querySelector(".cm-highlight-mark")).toBeInTheDocument();
    view.destroy();
  });
});
