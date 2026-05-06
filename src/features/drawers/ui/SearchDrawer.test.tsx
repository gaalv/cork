import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";

import { SearchDrawer } from "./SearchDrawer";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { search: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

beforeEach(() => {
  vi.useFakeTimers();
  clientMock.notes.search.mockReset();
  useDrawersStore.setState({
    expandedFolders: new Set<string>(),
    expandedTags: new Set<string>(),
    selectedTag: null,
    searchHistory: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SearchDrawer", () => {
  it("shows recent searches before a query", () => {
    useDrawersStore.setState({ searchHistory: ["react", "rust"] });

    render(<SearchDrawer />);

    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "react" })).toBeInTheDocument();
  });

  it("debounces search and opens a result", async () => {
    const onOpenNote = vi.fn();
    clientMock.notes.search.mockResolvedValue([
      {
        id: "n1",
        path: "/vault/react.md",
        title: "React notes",
        folder: "work",
        size: 10,
        mtime: 123,
        snippet: "Learning <mark>React</mark> hooks",
        rank: -1,
      },
    ]);

    render(<SearchDrawer onOpenNote={onOpenNote} />);
    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "react" } });

    expect(clientMock.notes.search).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120);
    });

    expect(clientMock.notes.search).toHaveBeenCalledWith("react", 30);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /React notes/i }));

    expect(onOpenNote).toHaveBeenCalledWith("n1");
    expect(useDrawersStore.getState().searchHistory[0]).toBe("react");
  });
});
