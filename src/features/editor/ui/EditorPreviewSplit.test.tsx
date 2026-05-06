import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { EditorPreviewSplit } from "./EditorPreviewSplit";

beforeEach(() => {
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
  useEditorStore.getState().openBuffer({
    noteId: "n1",
    file: { path: "note.md", frontmatter: {}, body: "# Heading", mtime: 1 },
  });
});

describe("EditorPreviewSplit", () => {
  it("toggles preview with command period", () => {
    render(<EditorPreviewSplit />);
    expect(screen.getByLabelText("Markdown preview pane")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: ".", metaKey: true });
    expect(screen.queryByLabelText("Markdown preview pane")).not.toBeInTheDocument();
  });

  it("shows large-file degraded mode", () => {
    useEditorStore.getState().updateBody("n1", "a".repeat(1024 * 1024 + 1));
    render(<EditorPreviewSplit />);

    expect(screen.getByRole("status")).toHaveTextContent("Large file mode");
  });
});
