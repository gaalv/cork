import { beforeEach, describe, expect, it } from "vitest";

import { useNoteViewStore } from "./noteViewStore";

beforeEach(() => {
  useNoteViewStore.getState().reset();
});

describe("noteViewStore", () => {
  it("tracks panel state and active note path", () => {
    useNoteViewStore.getState().setActiveNotePath("/vault/a.md");
    useNoteViewStore.getState().togglePanelCollapsed();
    useNoteViewStore.getState().setActiveSection("backlinks");

    expect(useNoteViewStore.getState().activeNotePath).toBe("/vault/a.md");
    expect(useNoteViewStore.getState().panelCollapsed).toBe(true);
    expect(useNoteViewStore.getState().activeSection).toBe("backlinks");
  });

  it("preserves scroll positions per note", () => {
    useNoteViewStore.getState().saveScrollPosition("n1", 120);

    expect(useNoteViewStore.getState().getScrollPosition("n1")).toBe(120);
    expect(useNoteViewStore.getState().getScrollPosition("missing")).toBe(0);
  });
});
