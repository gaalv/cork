import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEditorStore } from "@/features/editor/state/editorStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { Preview } from "./Preview";

beforeEach(() => {
  useEditorStore.setState({ activeNoteId: null, buffers: new Map() });
  useVaultStore.setState({ path: null, notes: [], isLoading: false, error: null });
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

  it("renders local image sources through the asset protocol", () => {
    useVaultStore.setState({ path: "/vault" });
    useEditorStore.getState().openBuffer({
      noteId: "n1",
      file: { path: "/vault/notes/today.md", frontmatter: {}, body: "![Logo](../assets/My%20Logo%20æ.png)", mtime: 1 },
    });

    render(<Preview />);

    const image = screen.getByRole("img", { name: "Logo" });
    expect(image).toHaveAttribute("src", "asset://localhost//vault/assets/My%20Logo%20%C3%A6.png");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("shows placeholders for blocked and missing images", () => {
    useVaultStore.setState({ path: "/vault" });
    useEditorStore.getState().openBuffer({
      noteId: "n1",
      file: {
        path: "/vault/notes/today.md",
        frontmatter: {},
        body: "![Secret](../../secret.png)\n\n![Missing](missing.png)",
        mtime: 1,
      },
    });

    render(<Preview assetExists={(path) => !path.endsWith("missing.png")} />);

    expect(screen.getByRole("img", { name: "Secret: External path blocked" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Missing: File not found: missing.png" })).toHaveAttribute(
      "title",
      "File not found: missing.png",
    );
  });
});
