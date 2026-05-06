import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { TopBar } from "./TopBar";

beforeEach(() => {
  useShellStore.getState().reset();
  useVaultStore.setState({ path: "/Users/me/Vault", notes: [], isLoading: false, error: null });
});

describe("TopBar", () => {
  it("renders the home vault actions", () => {
    render(<TopBar />);

    expect(screen.getByText("Vault: Vault")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vá para nota/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova nota" })).toBeInTheDocument();
  });

  it("renders note breadcrumbs and opens the folder drawer", () => {
    useVaultStore.setState({
      path: "/Users/me/Vault",
      notes: [{ id: "n1", path: "/Users/me/Vault/projects/Plan.md", title: "Plan", folder: "projects", size: 1, mtime: 1 }],
    });
    useShellStore.getState().navigate({ kind: "note", id: "n1" });

    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: "projects" }));

    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(useShellStore.getState().drawer).toBe("folders");
  });
});
