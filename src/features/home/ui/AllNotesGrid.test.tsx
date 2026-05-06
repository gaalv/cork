import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AllNotesGrid } from "./AllNotesGrid";

const note = { id: "n1", path: "/vault/a.md", title: "Alpha", folder: "", size: 1, mtime: 1 };

describe("AllNotesGrid", () => {
  it("renders notes and loads more", () => {
    const onLoadMore = vi.fn();

    render(
      <AllNotesGrid
        notes={[note]}
        hasMore
        onLoadMore={onLoadMore}
        onOpen={vi.fn()}
        onPinToggle={vi.fn()}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more notes" }));

    expect(onLoadMore).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    render(
      <AllNotesGrid
        notes={[]}
        hasMore={false}
        onLoadMore={vi.fn()}
        onOpen={vi.fn()}
        onPinToggle={vi.fn()}
      />,
    );

    expect(screen.getByText(/No notes have been indexed/)).toBeInTheDocument();
  });
});
