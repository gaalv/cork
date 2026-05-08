import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { HomeView } from "./HomeView";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { allPaged: vi.fn(), recent: vi.fn(), read: vi.fn() },
    tags: { list: vi.fn() },
    events: { on: vi.fn() },
    todos: { load: vi.fn(), save: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const note = { id: "n1", path: "/vault/a.md", title: "Alpha", folder: "", size: 1, mtime: 1 };

beforeEach(() => {
  clientMock.notes.allPaged.mockReset();
  clientMock.notes.recent.mockReset();
  clientMock.notes.read.mockReset();
  clientMock.tags.list.mockReset();
  clientMock.events.on.mockReset();
  clientMock.todos.load.mockReset();
  clientMock.todos.save.mockReset();
  clientMock.events.on.mockResolvedValue(vi.fn());
  clientMock.notes.allPaged.mockResolvedValue([note]);
  clientMock.notes.recent.mockResolvedValue([note]);
  clientMock.notes.read.mockResolvedValue({
    path: note.path,
    frontmatter: {},
    body: "Body",
    mtime: 1,
  });
  clientMock.tags.list.mockResolvedValue([]);
  clientMock.todos.load.mockResolvedValue({ todos: [] });
  clientMock.todos.save.mockResolvedValue({ todos: [] });
  useShellStore.getState().reset();
  useVaultStore.setState({ path: "/vault", notes: [note], isLoading: false, error: null });
});

describe("HomeView", () => {
  it("composes real sections and navigates to notes", async () => {
    render(<HomeView />);

    await waitFor(() => expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Alpha")[0]!);

    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "n1" });
  });

  it("shows the empty vault CTA", async () => {
    clientMock.notes.allPaged.mockResolvedValue([]);
    clientMock.notes.recent.mockResolvedValue([]);
    useVaultStore.setState({ notes: [] });

    render(<HomeView />);

    await waitFor(() => expect(screen.getByText("Create your first note")).toBeInTheDocument());
  });
});
