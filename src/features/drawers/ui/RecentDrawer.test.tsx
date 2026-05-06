import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { bucketRecentNotes } from "@/features/drawers/hooks/useRecentBuckets";

import { RecentDrawer } from "./RecentDrawer";

import type { NoteEntry } from "@/shared/ipc/types";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { recent: vi.fn() },
    events: { on: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const baseNote = (id: string, title: string, mtime: number): NoteEntry => ({
  id,
  title,
  mtime,
  path: `/vault/${id}.md`,
  folder: "",
  size: 1,
});

beforeEach(() => {
  clientMock.notes.recent.mockReset();
  clientMock.events.on.mockReset().mockResolvedValue(vi.fn());
});

describe("RecentDrawer", () => {
  it("buckets recent notes", () => {
    const now = new Date("2026-05-06T12:00:00Z");
    const buckets = bucketRecentNotes(
      [
        baseNote("today", "Today", Date.parse("2026-05-06T10:00:00Z")),
        baseNote("yesterday", "Yesterday", Date.parse("2026-05-05T10:00:00Z")),
        baseNote("week", "Week", Date.parse("2026-05-03T10:00:00Z")),
        baseNote("earlier", "Earlier", Date.parse("2026-04-01T10:00:00Z")),
      ],
      now,
    );

    expect(buckets.map((bucket) => bucket.label)).toEqual(["Today", "Yesterday", "This week", "Earlier"]);
  });

  it("renders top recent notes from IPC", async () => {
    clientMock.notes.recent.mockResolvedValue([baseNote("n1", "Alpha", Date.now())]);

    render(<RecentDrawer />);

    await waitFor(() => expect(clientMock.notes.recent).toHaveBeenCalledWith(50));
    expect(await screen.findByRole("button", { name: /Alpha/i })).toBeInTheDocument();
  });
});
