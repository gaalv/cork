import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { EmptyVault } from "./EmptyVault";

beforeEach(() => {
  useVaultStore.setState({ path: null, notes: [], isLoading: false, error: null, openVault: vi.fn().mockResolvedValue(undefined) });
});

describe("EmptyVault", () => {
  it("renders when no vault path is configured", () => {
    render(<EmptyVault />);

    expect(screen.getByRole("heading", { name: "Open a vault to begin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Vault" })).toBeInTheDocument();
  });
});
