import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { beforeEach, describe, expect, it } from "vitest";

import { useIndexStore } from "@/features/index/state/indexStore";

import { tagCompletionSource } from "./tagAutocomplete";

beforeEach(() => {
  useIndexStore.setState({ tags: [{ tag: "react", count: 5 }, { tag: "rust", count: 2 }] });
});

describe("tagCompletionSource", () => {
  it("suggests known tags after #", () => {
    const state = EditorState.create({ doc: "Ship #re" });
    const result = tagCompletionSource(new CompletionContext(state, state.doc.length, true));

    expect(result?.options[0]).toMatchObject({ label: "#react", apply: "#react" });
  });
});
