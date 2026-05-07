import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { liveMarkdownDecorations } from "./liveMarkdownDecorations";
import { liveModeFacet } from "./liveModeFacet";

function makeView(doc: string, mode: "live" | "source" = "live") {
  const parent = document.createElement("div");
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [liveModeFacet.of(mode), liveMarkdownDecorations],
    }),
  });
  return { parent, view };
}

describe("liveMarkdownDecorations", () => {
  it("decorates bold ranges and conceals markers when caret is outside", () => {
    const { parent, view } = makeView("hello **world** end");
    view.dispatch({ selection: { anchor: 0 } });
    expect(parent.querySelector(".cm-md-bold")).toBeInTheDocument();
    expect(parent.textContent).not.toContain("**");
    view.destroy();
  });

  it("reveals the bold markers while the caret is inside the range", () => {
    const { parent, view } = makeView("**bold**");
    view.dispatch({ selection: { anchor: 4 } });
    expect(parent.textContent).toContain("**");
    view.destroy();
  });

  it("decorates inline code and italic markers", () => {
    const { parent, view } = makeView("a *italic* and `code` here");
    view.dispatch({ selection: { anchor: 0 } });
    expect(parent.querySelector(".cm-md-italic")).toBeInTheDocument();
    expect(parent.querySelector(".cm-md-code")).toBeInTheDocument();
    view.destroy();
  });

  it("decorates strikethrough", () => {
    const { parent, view } = makeView("~~gone~~ now");
    view.dispatch({ selection: { anchor: 0 } });
    expect(parent.querySelector(".cm-md-strike")).toBeInTheDocument();
    view.destroy();
  });

  it("hides the URL part of a link when the caret is outside", () => {
    const { parent, view } = makeView("see [GitHub](https://github.com) here");
    view.dispatch({ selection: { anchor: 0 } });
    expect(parent.querySelector(".cm-md-link")).toBeInTheDocument();
    expect(parent.textContent).not.toContain("github.com");
    view.destroy();
  });

  it("disables every decoration in source mode", () => {
    const { parent, view } = makeView("**bold** and `code`", "source");
    view.dispatch({ selection: { anchor: 0 } });
    expect(parent.querySelector(".cm-md-bold")).toBeNull();
    expect(parent.querySelector(".cm-md-code")).toBeNull();
    expect(parent.textContent).toContain("**");
    view.destroy();
  });

  it("does not decorate inside fenced code blocks", () => {
    const { parent, view } = makeView("```\n**not bold**\n```");
    view.dispatch({ selection: { anchor: 0 } });
    expect(parent.querySelector(".cm-md-bold")).toBeNull();
    view.destroy();
  });
});
