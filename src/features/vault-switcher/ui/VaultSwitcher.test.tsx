import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecentVaultsStore } from "../state/recentVaultsStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";
import { VaultSwitcher } from "./VaultSwitcher";

const { switchVaultMock } = vi.hoisted(() => ({
  switchVaultMock: vi.fn(),
}));

vi.mock("@/features/vault-switcher/services/switchVault", () => ({
  switchVault: switchVaultMock,
}));

describe("VaultSwitcher", () => {
  beforeEach(() => {
    switchVaultMock.mockReset();
    switchVaultMock.mockResolvedValue(undefined);
    useVaultStore.setState({ path: "/Users/me/Vault A", notes: [], isLoading: false, error: null });
    useRecentVaultsStore.setState({
      vaults: [
        { path: "/Users/me/Vault A", name: "Vault A", missing: false },
        { path: "/Users/me/Vault B", name: "Vault B", missing: false },
      ],
      isLoading: false,
      error: null,
      loadRecent: vi.fn().mockResolvedValue(undefined),
      removeRecent: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("lists recent vaults and switches to a selected vault", async () => {
    render(<VaultSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /Vault: Vault A/ }));

    expect(screen.getByText("Vault B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Vault B/ }));

    await waitFor(() => expect(switchVaultMock).toHaveBeenCalledWith({ path: "/Users/me/Vault B" }));
  });

  it("opens another vault through the picker flow", async () => {
    render(<VaultSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /Vault: Vault A/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open another vault…" }));

    await waitFor(() => expect(switchVaultMock).toHaveBeenCalledWith(undefined));
  });

  it("prompts before acting on a missing vault", async () => {
    const removeRecent = vi.fn().mockResolvedValue(undefined);
    useRecentVaultsStore.setState({
      vaults: [{ path: "/gone/Vault", name: "Vault", missing: true }],
      removeRecent,
      loadRecent: vi.fn().mockResolvedValue(undefined),
    });
    render(<VaultSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: /Vault: Vault A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Vault.*Missing/ }));

    expect(screen.getByRole("dialog", { name: "Vault not found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove from list" }));

    await waitFor(() => expect(removeRecent).toHaveBeenCalledWith("/gone/Vault"));
  });
});
