import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { ConflictBanner } from "./ConflictBanner";
import { SaveIndicator } from "./SaveIndicator";

beforeEach(() => {
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
  useEditorStore.getState().openBuffer({
    noteId: "n1",
    file: { path: "note.md", frontmatter: {}, body: "Body", mtime: 1 },
  });
});

describe("editor status UI", () => {
  it("shows save indicator transitions", () => {
    const { rerender } = render(<SaveIndicator />);
    expect(screen.getByLabelText("Save status")).toHaveTextContent("Saved");

    useEditorStore.getState().updateBody("n1", "Changed");
    rerender(<SaveIndicator />);
    expect(screen.getByLabelText("Save status")).toHaveTextContent("Unsaved changes");

    useEditorStore.getState().markSaving("n1");
    rerender(<SaveIndicator />);
    expect(screen.getByLabelText("Save status")).toHaveTextContent("Saving");
  });

  it("resolves conflicts from banner actions", () => {
    const onDiff = vi.fn();
    useEditorStore.getState().setConflict("n1", { externalMtime: 2 });
    const { rerender } = render(<ConflictBanner onDiff={onDiff} />);

    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(useEditorStore.getState().buffers.get("n1")?.conflict).toBeNull();

    useEditorStore.getState().setConflict("n1", { externalMtime: 3 });
    rerender(<ConflictBanner onDiff={onDiff} />);
    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(onDiff).toHaveBeenCalled();
  });
});
