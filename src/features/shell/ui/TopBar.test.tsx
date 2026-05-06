import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { TopBar } from "./TopBar";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      rename: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

beforeEach(() => {
  clientMock.notes.rename.mockReset();
  clientMock.notes.rename.mockResolvedValue({ path: "/Users/me/Vault/projects/Renamed.md" });
  useShellStore.getState().reset();
  useVaultStore.setState({ path: "/Users/me/Vault", notes: [], isLoading: false, error: null, loadNotes: vi.fn().mockResolvedValue(undefined) });
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
      loadNotes: vi.fn().mockResolvedValue(undefined),
    });
    useShellStore.getState().navigate({ kind: "note", id: "n1" });

    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: "projects" }));

    expect(screen.getByRole("button", { name: "Plan" })).toBeInTheDocument();
    expect(useShellStore.getState().drawer).toBe("folders");
  });

  it("renames the active note title inline", async () => {
    const user = userEvent.setup();
    const loadNotes = vi.fn().mockResolvedValue(undefined);
    useVaultStore.setState({
      path: "/Users/me/Vault",
      notes: [{ id: "n1", path: "/Users/me/Vault/projects/Plan.md", title: "Plan", folder: "projects", size: 1, mtime: 1 }],
      loadNotes,
    });
    useShellStore.getState().navigate({ kind: "note", id: "n1" });

    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    const input = screen.getByRole("textbox", { name: "Rename active note" });
    await user.clear(input);
    await user.type(input, "Renamed{Enter}");

    await waitFor(() => expect(clientMock.notes.rename).toHaveBeenCalledWith({ oldPath: "/Users/me/Vault/projects/Plan.md", newName: "Renamed" }));
    expect(loadNotes).toHaveBeenCalled();
  });

  it("cancels active note rename on Escape", async () => {
    const user = userEvent.setup();
    useVaultStore.setState({
      path: "/Users/me/Vault",
      notes: [{ id: "n1", path: "/Users/me/Vault/projects/Plan.md", title: "Plan", folder: "projects", size: 1, mtime: 1 }],
      loadNotes: vi.fn().mockResolvedValue(undefined),
    });
    useShellStore.getState().navigate({ kind: "note", id: "n1" });

    render(<TopBar />);
    await user.click(screen.getByRole("button", { name: "Plan" }));
    await user.keyboard("{Escape}");

    expect(clientMock.notes.rename).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Plan" })).toBeInTheDocument();
  });
});
