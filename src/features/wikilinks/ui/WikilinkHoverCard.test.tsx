import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { WikilinkHoverCard } from "./WikilinkHoverCard";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      read: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const link = {
  srcNoteId: "n1",
  targetText: "Target",
  targetId: "n2",
  position: 0,
  alias: null,
  ambiguous: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useVaultStore.setState({
    path: "/vault",
    notes: [{ id: "n2", path: "/vault/target.md", title: "Target", folder: "", size: 1, mtime: 1 }],
    isLoading: false,
    error: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WikilinkHoverCard", () => {
  it("shows a delayed preview for resolved links", async () => {
    clientMock.notes.read.mockResolvedValue({ path: "/vault/target.md", frontmatter: {}, body: "Preview body", mtime: 1 });
    render(
      <WikilinkHoverCard link={link}>
        <button type="button">Target</button>
      </WikilinkHoverCard>,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Target" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Target");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Preview body");
  });
});
