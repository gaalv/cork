import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PinnedGrid } from "./PinnedGrid";
import { RecentsList } from "./RecentsList";

const note = {
  id: "n1",
  path: "/vault/a.md",
  title: "Alpha",
  folder: "work",
  size: 1,
  mtime: Date.UTC(2026, 4, 6),
  frontmatter: { pinned: true },
  snippet: "Preview",
  pinned: true,
  starred: false,
};

describe("home sections", () => {
  it("renders pinned note cards", () => {
    render(<PinnedGrid notes={[note]} onOpen={vi.fn()} onPinToggle={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Start here" })).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("shows an empty pinned state", () => {
    render(<PinnedGrid notes={[]} onOpen={vi.fn()} onPinToggle={vi.fn()} />);

    expect(screen.getByText(/Star important notes/)).toBeInTheDocument();
  });

  it("opens recent notes", () => {
    const onOpen = vi.fn();

    render(<RecentsList notes={[note]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));

    expect(onOpen).toHaveBeenCalledWith(note);
  });
});
