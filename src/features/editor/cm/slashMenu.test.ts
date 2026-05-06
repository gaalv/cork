import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { slashCompletionSource } from "./slashMenu";

describe("slashCompletionSource", () => {
  it("offers a code block insertion on an empty line", () => {
    const state = EditorState.create({ doc: "/co" });
    const result = slashCompletionSource(new CompletionContext(state, state.doc.length, true));

    expect(result?.options[0]).toMatchObject({ label: "/code", apply: "```ts\n\n```" });
  });
});
