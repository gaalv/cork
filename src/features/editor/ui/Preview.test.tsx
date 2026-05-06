import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { Preview } from "./Preview";

beforeEach(() => {
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
});

describe("Preview", () => {
  it("renders headings, lists, wikilinks, and task toggles", () => {
    const onWikilinkClick = vi.fn();
    useEditorStore.getState().openBuffer({
      noteId: "n1",
      file: { path: "note.md", frontmatter: {}, body: "# Hello World\n\n- [ ] ship\n\nSee [[Other Note|other]].", mtime: 1 },
    });

    render(<Preview onWikilinkClick={onWikilinkClick} />);

    expect(screen.getByRole("heading", { name: "Hello World" })).toHaveAttribute("id", "hello-world");
    fireEvent.click(screen.getByRole("button", { name: "other" }));
    expect(onWikilinkClick).toHaveBeenCalledWith("Other Note");

    fireEvent.click(screen.getByLabelText("Toggle task"));
    expect(useEditorStore.getState().buffers.get("n1")?.body).toContain("- [x] ship");
  });
});
