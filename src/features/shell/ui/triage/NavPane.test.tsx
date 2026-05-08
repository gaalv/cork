import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTriageStore } from "@/features/shell/state/triageStore";

vi.mock("@/features/drawers/hooks/useFolderTree", () => ({
  useFolderTree: () => [
    { id: "projects", name: "Projects", path: "Projects", count: 3, notes: [], children: [] },
    { id: "daily", name: "Daily", path: "Daily", count: 1, notes: [], children: [] },
  ],
}));

vi.mock("@/features/drawers/hooks/useTagTree", () => ({
  useTagTree: () => ({
    tree: [
      { id: "meetings", name: "meetings", tag: "meetings", count: 5, children: [] },
      { id: "ideas", name: "ideas", tag: "ideas", count: 2, children: [] },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/features/sync/ui/SyncIndicator", () => ({
  SyncIndicator: () => null,
}));

vi.mock("@/features/note-ops/services/createAndOpenNote", () => ({
  createAndOpenNote: vi.fn(),
}));

import { NavPane } from "./NavPane";

beforeEach(() => {
  useTriageStore.getState().reset();
});

describe("NavPane", () => {
  it("renders shortcuts, folders, and tags", () => {
    render(<NavPane />);
    expect(screen.getByTestId("nav-shortcut-pinned")).toBeTruthy();
    expect(screen.getByTestId("nav-shortcut-recent")).toBeTruthy();
    expect(screen.getByTestId("nav-shortcut-inbox")).toBeTruthy();
    expect(screen.getByTestId("nav-folder-Projects")).toBeTruthy();
    expect(screen.getByTestId("nav-tag-meetings")).toBeTruthy();
  });

  it("clicking a folder updates the triage selection", () => {
    render(<NavPane />);
    fireEvent.click(screen.getByTestId("nav-folder-Projects"));
    expect(useTriageStore.getState().selection).toEqual({ kind: "folder", path: "Projects" });
  });

  it("clicking a tag updates the triage selection", () => {
    render(<NavPane />);
    fireEvent.click(screen.getByTestId("nav-tag-meetings"));
    expect(useTriageStore.getState().selection).toEqual({ kind: "tag", tag: "meetings" });
  });

  it("clicking a shortcut updates the triage selection", () => {
    render(<NavPane />);
    fireEvent.click(screen.getByTestId("nav-shortcut-pinned"));
    expect(useTriageStore.getState().selection).toEqual({ kind: "shortcut", id: "pinned" });
  });
});
