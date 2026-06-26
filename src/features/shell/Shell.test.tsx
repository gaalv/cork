import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { Shell } from "./index";

const { scaffoldIfNeededMock, toastSuccessMock } = vi.hoisted(() => ({
  scaffoldIfNeededMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

vi.mock("@/shared/ipc/client", () => ({
  client: {
    vault: { scaffoldIfNeeded: scaffoldIfNeededMock },
    events: { on: vi.fn().mockResolvedValue(() => undefined) },
    folders: { list: vi.fn().mockResolvedValue([]) },
    notes: { pinned: vi.fn().mockResolvedValue([]) },
    index: { search: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: {
    success: toastSuccessMock,
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

beforeEach(() => {
  scaffoldIfNeededMock.mockReset();
  scaffoldIfNeededMock.mockResolvedValue({ created: false, files: [] });
  toastSuccessMock.mockReset();
  useShellStore.getState().reset();
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "n1", path: "/vault/A.md", title: "Alpha", folder: "", snippet: "", size: 1, mtime: 1 }],
    isLoading: false,
    error: null,
    loadNotes: vi.fn().mockResolvedValue(undefined),
    startWatcherIntegration: vi.fn().mockResolvedValue(undefined),
  });
  useIndexStore.setState({ startIndexIntegration: vi.fn().mockResolvedValue(undefined) });
  useAppSettingsStore.setState({ loadVaultSettings: vi.fn().mockResolvedValue(undefined) });
});

describe("Shell", () => {
  it("renders the triage layout for an open vault", () => {
    render(<Shell />);

    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("shows empty vault state when no vault is open", () => {
    useVaultStore.setState({ path: null, notes: [] });

    render(<Shell />);

    expect(screen.getByRole("heading", { name: "Open a vault to begin" })).toBeInTheDocument();
  });

  it("toasts when an empty vault gets scaffolded", async () => {
    const loadNotes = vi.fn().mockResolvedValue(undefined);
    scaffoldIfNeededMock.mockResolvedValue({ created: true, files: ["Welcome.md"] });
    useVaultStore.setState({ path: "/vault", notes: [], loadNotes });

    render(<Shell />);

    await waitFor(() => expect(scaffoldIfNeededMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadNotes).toHaveBeenCalledTimes(2));
    expect(toastSuccessMock).toHaveBeenCalledWith("Welcome to Cork — example notes added");
  });
});
