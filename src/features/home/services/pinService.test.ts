import { beforeEach, describe, expect, it, vi } from "vitest";

import { togglePin } from "./pinService";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: { read: vi.fn(), save: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

beforeEach(() => {
  clientMock.notes.read.mockReset();
  clientMock.notes.save.mockReset();
});

describe("pinService", () => {
  it("toggles pinned frontmatter", async () => {
    clientMock.notes.read.mockResolvedValue({ path: "/vault/a.md", frontmatter: {}, body: "Body", mtime: 10 });
    clientMock.notes.save.mockResolvedValue({ path: "/vault/a.md", mtime: 11 });

    await expect(togglePin({ path: "/vault/a.md" })).resolves.toBe(true);

    expect(clientMock.notes.save).toHaveBeenCalledWith({
      path: "/vault/a.md",
      frontmatter: { pinned: true },
      body: "Body",
      expectedMtime: 10,
    });
  });
});
