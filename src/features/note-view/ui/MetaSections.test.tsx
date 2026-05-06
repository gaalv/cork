import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BacklinksList } from "./BacklinksList";
import { NoteMetaFooter } from "./NoteMetaFooter";
import { Outline } from "./Outline";
import { RecentsList } from "./RecentsList";

const note = { id: "n2", path: "/vault/b.md", title: "Beta", folder: "", size: 1, mtime: 1 };

describe("note meta sections", () => {
  it("renders outline and handles selection", () => {
    const onSelect = vi.fn();
    render(<Outline items={[{ id: "1-title", depth: 1, text: "Title", line: 1 }]} activeId="1-title" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Title" }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ line: 1 }));
  });

  it("opens backlinks", () => {
    const onOpen = vi.fn();
    render(
      <BacklinksList
        backlinks={[{ srcNoteId: "n2", targetText: "Alpha", targetId: "n1", position: 1, alias: null, ambiguous: false, source: note }]}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));

    expect(onOpen).toHaveBeenCalledWith(note);
  });

  it("excludes current note from recents", () => {
    render(<RecentsList notes={[note]} currentNoteId="n2" onOpen={vi.fn()} />);

    expect(screen.getByText("No other recent notes.")).toBeInTheDocument();
  });

  it("renders word count footer", () => {
    render(<NoteMetaFooter body="one two three" updated={1} />);

    expect(screen.getByText("3 words")).toBeInTheDocument();
  });
});
