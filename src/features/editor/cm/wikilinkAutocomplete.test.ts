import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { beforeEach, describe, expect, it } from "vitest";

import { useIndexStore } from "@/features/index/state/indexStore";

import { wikilinkCompletionSource } from "./wikilinkAutocomplete";

beforeEach(() => {
  useIndexStore.setState({ recentNotes: [{ id: "n1", path: "notes/react.md", title: "React Notes", folder: "notes", size: 1, mtime: 1 }] });
});

describe("wikilinkCompletionSource", () => {
  it("suggests recent note titles after [[", () => {
    const state = EditorState.create({ doc: "See [[Re" });
    const result = wikilinkCompletionSource(new CompletionContext(state, state.doc.length, true));

    expect(result?.options[0]).toMatchObject({ label: "React Notes", apply: "[[React Notes]]" });
  });
});
