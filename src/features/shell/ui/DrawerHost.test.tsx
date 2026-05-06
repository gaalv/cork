import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";

import { DrawerHost } from "./DrawerHost";

beforeEach(() => {
  useShellStore.getState().reset();
});

describe("DrawerHost", () => {
  it("renders the active drawer and closes on Escape", () => {
    useShellStore.getState().toggleDrawer("search");

    render(<DrawerHost />);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(useShellStore.getState().drawer).toBeNull();
  });

  it("swaps drawer content from the store", () => {
    useShellStore.getState().toggleDrawer("search");
    const { rerender } = render(<DrawerHost />);

    expect(screen.getByRole("region", { name: "Search" })).toBeInTheDocument();

    useShellStore.getState().toggleDrawer("tags");
    rerender(<DrawerHost />);

    expect(screen.getByRole("region", { name: "Tags" })).toBeInTheDocument();
  });

  it("closes on outside click while keeping focusable controls inside", () => {
    useShellStore.getState().toggleDrawer("folders");
    render(<DrawerHost />);

    expect(screen.getByRole("button", { name: "Close drawer" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Close drawer overlay" }));

    expect(useShellStore.getState().drawer).toBeNull();
  });
});
