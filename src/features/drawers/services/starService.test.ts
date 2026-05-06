import { beforeEach, describe, expect, it, vi } from "vitest";

import { toggleStar } from "./starService";

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

describe("starService", () => {
  it("toggles starred frontmatter", async () => {
    clientMock.notes.read.mockResolvedValue({ path: "/vault/a.md", frontmatter: {}, body: "Body", mtime: 10 });
    clientMock.notes.save.mockResolvedValue({ path: "/vault/a.md", mtime: 11 });

    await expect(toggleStar({ path: "/vault/a.md" })).resolves.toBe(true);

    expect(clientMock.notes.save).toHaveBeenCalledWith({
      path: "/vault/a.md",
      frontmatter: { starred: true },
      body: "Body",
      expectedMtime: 10,
    });
  });
});
