import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";

import { TagsField } from "./TagsField";

const baseBuffer = {
  noteId: "n1",
  path: "/vault/Note.md",
  frontmatter: { tags: ["existing"] },
  body: "",
  loadedMtime: 1,
  dirty: false,
  saveStatus: "idle" as const,
  saveError: null,
  lastSavedAt: null,
  pendingSave: false,
  conflict: null,
};

beforeEach(() => {
  useEditorStore.setState({
    activeNoteId: "n1",
    buffers: new Map([["n1", { ...baseBuffer, frontmatter: { tags: ["existing"] } }]]),
  } as never);
});

describe("TagsField", () => {
  it("renders existing tags", () => {
    render(<TagsField noteId="n1" />);
    expect(screen.getByText("#existing")).toBeInTheDocument();
  });

  it("adds a new tag on submit", () => {
    render(<TagsField noteId="n1" />);
    fireEvent.change(screen.getByLabelText("New tag"), { target: { value: "rust" } });
    fireEvent.submit(screen.getByLabelText("New tag").closest("form")!);
    const buffer = useEditorStore.getState().buffers.get("n1")!;
    expect(buffer.frontmatter.tags).toEqual(["existing", "rust"]);
    expect(buffer.dirty).toBe(true);
  });

  it("rejects tags with spaces", () => {
    render(<TagsField noteId="n1" />);
    fireEvent.change(screen.getByLabelText("New tag"), { target: { value: "bad tag" } });
    fireEvent.submit(screen.getByLabelText("New tag").closest("form")!);
    expect(screen.getByText(/can't contain spaces/i)).toBeInTheDocument();
  });

  it("removes a tag", () => {
    render(<TagsField noteId="n1" />);
    fireEvent.click(screen.getByLabelText("Remove tag existing"));
    const buffer = useEditorStore.getState().buffers.get("n1")!;
    expect(buffer.frontmatter.tags).toEqual([]);
  });
});
