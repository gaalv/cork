import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteHistory } from "./NoteHistory";

const { clientMock, vcsClientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { read: vi.fn() },
    vcs: {
      status: vi.fn(),
      history: vi.fn(),
      restore: vi.fn(),
    },
  },
  vcsClientMock: {
    status: vi.fn(),
    history: vi.fn(),
    restore: vi.fn(),
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));
vi.mock("@/features/vcs/services/vcsClient", () => ({ vcsClient: vcsClientMock }));
vi.mock("@/features/editor/state/editorStore", () => ({
  useEditorStore: (selector: (s: { openBuffer: () => void }) => unknown) =>
    selector({ openBuffer: vi.fn() }),
}));

beforeEach(() => {
  vcsClientMock.status.mockReset();
  vcsClientMock.history.mockReset();
  vcsClientMock.restore.mockReset();
  clientMock.notes.read.mockReset();

  vcsClientMock.status.mockResolvedValue({ enabled: true, repoPath: "/vault", hasGit: true });
  vcsClientMock.history.mockResolvedValue([]);
});

describe("NoteHistory", () => {
  it("shows 'no versions yet' when list is empty", async () => {
    render(<NoteHistory notePath="/vault/note.md" noteId="n1" />);

    await waitFor(() => expect(screen.getByText(/no versions yet/i)).toBeInTheDocument());
  });

  it("shows commit entries", async () => {
    vcsClientMock.history.mockResolvedValue([
      {
        sha: "abc123def456",
        shortSha: "abc123d",
        message: "Update note.md",
        authorName: "Noxe",
        isoDate: new Date().toISOString(),
      },
    ]);

    render(<NoteHistory notePath="/vault/note.md" noteId="n1" />);

    await waitFor(() => expect(screen.getByText("Update note.md")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /restore version abc123d/i })).toBeInTheDocument();
  });

  it("shows confirm buttons after clicking Restore", async () => {
    vcsClientMock.history.mockResolvedValue([
      {
        sha: "abc123def456",
        shortSha: "abc123d",
        message: "Update note.md",
        authorName: "Noxe",
        isoDate: new Date().toISOString(),
      },
    ]);

    render(<NoteHistory notePath="/vault/note.md" noteId="n1" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /restore version abc123d/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /restore version abc123d/i }));

    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("cancels confirm when No is clicked", async () => {
    vcsClientMock.history.mockResolvedValue([
      {
        sha: "abc123def456",
        shortSha: "abc123d",
        message: "Update note.md",
        authorName: "Noxe",
        isoDate: new Date().toISOString(),
      },
    ]);

    render(<NoteHistory notePath="/vault/note.md" noteId="n1" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /restore version abc123d/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /restore version abc123d/i }));
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /restore version abc123d/i })).toBeInTheDocument(),
    );
  });

  it("shows calm message when git is not installed", async () => {
    vcsClientMock.status.mockResolvedValue({ enabled: false, repoPath: null, hasGit: false });

    render(<NoteHistory notePath="/vault/note.md" noteId="n1" />);

    await waitFor(() => expect(screen.getByText(/install git/i)).toBeInTheDocument());
  });

  it("renders nothing problematic when notePath is null", () => {
    render(<NoteHistory notePath={null} noteId={null} />);
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
  });
});
