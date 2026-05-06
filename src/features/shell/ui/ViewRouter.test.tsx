import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { ViewRouter } from "./ViewRouter";

beforeEach(() => {
  useShellStore.getState().reset();
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "n1", path: "/vault/A.md", title: "Alpha", folder: "", size: 1, mtime: 1 }],
    isLoading: false,
    error: null,
    openVault: vi.fn().mockResolvedValue(undefined),
  });
});

describe("ViewRouter", () => {
  it("renders empty state without a vault", () => {
    useVaultStore.setState({ path: null, notes: [] });

    render(<ViewRouter />);

    expect(screen.getByRole("heading", { name: "Open a vault to begin" })).toBeInTheDocument();
  });

  it("renders home and routes to a note", () => {
    render(<ViewRouter />);

    fireEvent.click(screen.getByRole("button", { name: /Alpha/ }));

    expect(screen.getByTestId("note-view")).toHaveTextContent("Alpha");
  });

  it("returns to home on Escape from a drawer-less note", () => {
    useShellStore.getState().navigate({ kind: "note", id: "n1" });
    render(<ViewRouter />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(useShellStore.getState().view).toEqual({ kind: "home" });
  });
});
