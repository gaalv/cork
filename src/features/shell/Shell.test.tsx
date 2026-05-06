import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { Shell } from "./index";

beforeEach(() => {
  useShellStore.getState().reset();
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "n1", path: "/vault/A.md", title: "Alpha", folder: "", size: 1, mtime: 1 }],
    isLoading: false,
    error: null,
    loadNotes: vi.fn().mockResolvedValue(undefined),
    startWatcherIntegration: vi.fn().mockResolvedValue(undefined),
  });
  useIndexStore.setState({ startIndexIntegration: vi.fn().mockResolvedValue(undefined) });
});

describe("Shell", () => {
  it("composes the Layout C surfaces for an open vault", () => {
    render(<Shell />);

    expect(screen.getByTestId("rail")).toBeInTheDocument();
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(screen.getByTestId("home-view")).toBeInTheDocument();
  });

  it("hides shell chrome when no vault is open", () => {
    useVaultStore.setState({ path: null, notes: [] });

    render(<Shell />);

    expect(screen.getByRole("heading", { name: "Open a vault to begin" })).toBeInTheDocument();
    expect(screen.queryByTestId("rail")).not.toBeInTheDocument();
  });
});
