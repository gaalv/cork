import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useTriageStore } from "@/features/shell/state/triageStore";
import { useTriageOverlayStore } from "@/features/shell/state/triageOverlayStore";

const recentMock = vi.fn();
const allPagedMock = vi.fn();
const byTagMock = vi.fn();
const starredMock = vi.fn();
const readMock = vi.fn();

vi.mock("@/shared/ipc/client", () => ({
  client: {
    notes: {
      recent: (...args: unknown[]) => recentMock(...args),
      allPaged: (...args: unknown[]) => allPagedMock(...args),
      byTag: (...args: unknown[]) => byTagMock(...args),
      starred: (...args: unknown[]) => starredMock(...args),
      read: (...args: unknown[]) => readMock(...args),
    },
  },
}));

import { ListPane } from "./ListPane";

const note = (id: string, title: string, folder = "", mtime = Date.now()) => ({
  id,
  path: `${folder ? folder + "/" : ""}${id}.md`,
  title,
  folder,
  size: 100,
  mtime,
});

const file = (body = "snippet line", tags: string[] = []) => ({
  path: "x.md",
  frontmatter: { tags } as Record<string, unknown>,
  body,
});

beforeEach(() => {
  useTriageStore.getState().reset();
  useShellStore.setState({ view: { kind: "home" } });
  useTriageOverlayStore.setState({ kind: null });
  recentMock.mockReset();
  allPagedMock.mockReset();
  byTagMock.mockReset();
  starredMock.mockReset();
  readMock.mockReset();
  readMock.mockResolvedValue(file());
});

describe("ListPane", () => {
  it("renders the scope label and notes for the recent shortcut", async () => {
    recentMock.mockResolvedValue([note("a", "Alpha"), note("b", "Beta")]);
    render(<ListPane />);
    await waitFor(() => expect(screen.getByTestId("triage-list-row-a")).toBeTruthy());
    expect(screen.getByTestId("triage-list-count").textContent).toContain("Recent");
    expect(screen.getByTestId("triage-list-count").textContent).toContain("2 notes");
  });

  it("filters notes by title via the search input", async () => {
    recentMock.mockResolvedValue([note("a", "Alpha"), note("b", "Beta")]);
    render(<ListPane />);
    await waitFor(() => expect(screen.getByTestId("triage-list-row-a")).toBeTruthy());
    fireEvent.change(screen.getByTestId("triage-list-search"), { target: { value: "alp" } });
    await waitFor(() => expect(screen.queryByTestId("triage-list-row-b")).toBeNull());
    expect(screen.getByTestId("triage-list-row-a")).toBeTruthy();
  });

  it("clicking a row navigates the shell to that note", async () => {
    recentMock.mockResolvedValue([note("a", "Alpha")]);
    render(<ListPane />);
    await waitFor(() => expect(screen.getByTestId("triage-list-row-a")).toBeTruthy());
    fireEvent.click(screen.getByTestId("triage-list-row-a"));
    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "a" });
  });

  it("uses byTag for tag selections and renders tag pills", async () => {
    byTagMock.mockResolvedValue([note("c", "Gamma")]);
    readMock.mockResolvedValue(file("Gamma body", ["meetings"]));
    useTriageStore.getState().setSelection({ kind: "tag", tag: "meetings" });
    render(<ListPane />);
    await waitFor(() => expect(byTagMock).toHaveBeenCalledWith("meetings"));
    await waitFor(() => expect(screen.getByText("#meetings")).toBeTruthy());
  });

  it("filters by folder prefix for folder selections", async () => {
    allPagedMock.mockResolvedValue([
      note("a", "Alpha", "Projects"),
      note("b", "Beta", "Projects/Sub"),
      note("c", "Gamma", "Other"),
    ]);
    useTriageStore.getState().setSelection({ kind: "folder", path: "Projects" });
    render(<ListPane />);
    await waitFor(() =>
      expect(screen.getByTestId("triage-list-count").textContent).toContain("2 notes"),
    );
  });

  it("shows empty state when there are no notes", async () => {
    recentMock.mockResolvedValue([]);
    render(<ListPane />);
    await waitFor(() => expect(screen.getByText("No notes here yet.")).toBeTruthy());
  });

  it("auto-selects the first note when nothing is open", async () => {
    recentMock.mockResolvedValue([note("a", "Alpha"), note("b", "Beta")]);
    render(<ListPane />);
    await waitFor(() => expect(useShellStore.getState().view).toEqual({ kind: "note", id: "a" }));
  });

  it("does not auto-select while a tool overlay is open", async () => {
    recentMock.mockResolvedValue([note("a", "Alpha")]);
    useTriageOverlayStore.setState({ kind: "calendar" });
    render(<ListPane />);
    await waitFor(() => expect(screen.getByTestId("triage-list-row-a")).toBeTruthy());
    expect(useShellStore.getState().view).toEqual({ kind: "home" });
  });
});
