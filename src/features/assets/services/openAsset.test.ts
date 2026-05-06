import { describe, expect, it, vi } from "vitest";

import { openAsset } from "./openAsset";

describe("openAsset", () => {
  const vault = "/vault";
  const note = "/vault/notes/today.md";

  it("opens a safe non-image asset with the OS opener", async () => {
    const opener = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(openAsset("../files/manual.pdf", note, vault, { opener })).resolves.toEqual({
      status: "opened",
      path: "/vault/files/manual.pdf",
    });
    expect(opener).toHaveBeenCalledWith("/vault/files/manual.pdf");
  });

  it("requires confirmation for non-safelisted extensions", async () => {
    const opener = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(openAsset("archive.pkg", note, vault, { opener })).resolves.toEqual({
      status: "confirmation-required",
      path: "/vault/notes/archive.pkg",
      fileName: "archive.pkg",
    });
    expect(opener).not.toHaveBeenCalled();
  });

  it("opens non-safelisted extensions after confirmation", async () => {
    const opener = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(
      openAsset("archive.pkg", note, vault, { opener, confirmUnsafe: () => true }),
    ).resolves.toMatchObject({ status: "opened" });
    expect(opener).toHaveBeenCalledWith("/vault/notes/archive.pkg");
  });

  it("blocks files outside the vault", async () => {
    const opener = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(openAsset("../../secret.pdf", note, vault, { opener })).resolves.toEqual({
      status: "blocked",
      reason: "outside-vault",
      path: "/secret.pdf",
    });
    expect(opener).not.toHaveBeenCalled();
  });

  it("returns missing when the resolver cannot find the file", async () => {
    const opener = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await expect(openAsset("missing.pdf", note, vault, { opener, exists: () => false })).resolves.toEqual({
      status: "missing",
      path: "/vault/notes/missing.pdf",
    });
    expect(opener).not.toHaveBeenCalled();
  });
});
