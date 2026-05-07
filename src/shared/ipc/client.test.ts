import { beforeEach, describe, expect, it, vi } from "vitest";

import { client } from "./client";

const { invokeMock, listenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("ipc client", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("invokes typed vault commands", async () => {
    invokeMock.mockResolvedValue([
      { id: "1", path: "/v/a.md", title: "A", folder: "", size: 1, mtime: 2 },
    ]);

    const result = await client.vault.list();

    expect(invokeMock).toHaveBeenCalledWith("vault_list", undefined);
    expect(result[0]?.title).toBe("A");
  });

  it("wraps note save input for rust command arguments", async () => {
    invokeMock.mockResolvedValue({ path: "/v/a.md", mtime: 2 });

    await client.notes.save({ path: "/v/a.md", frontmatter: {}, body: "body", expectedMtime: 1 });

    expect(invokeMock).toHaveBeenCalledWith("notes_save", {
      input: { path: "/v/a.md", frontmatter: {}, body: "body", expectedMtime: 1 },
    });
  });

  it("surfaces invoke errors to callers", async () => {
    invokeMock.mockRejectedValue({ kind: "NotFound" });

    await expect(client.notes.read("missing.md")).rejects.toThrow("NotFound");
  });

  it("listens to events and camel-cases payloads", async () => {
    const unlisten = vi.fn();
    listenMock.mockImplementation((_event, callback: (event: { payload: unknown }) => void) => {
      callback({ payload: { old_path: "/old.md", new_path: "/new.md" } });
      return Promise.resolve(unlisten);
    });
    const callback = vi.fn();

    const result = await client.events.on("vault:fileRenamed", callback);

    expect(listenMock).toHaveBeenCalledWith("vault:fileRenamed", expect.any(Function));
    expect(callback).toHaveBeenCalledWith({ oldPath: "/old.md", newPath: "/new.md" });
    expect(result).toBe(unlisten);
  });
});
