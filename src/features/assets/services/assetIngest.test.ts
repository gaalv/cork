import { describe, expect, it, vi } from "vitest";

import { ingestDroppedImage, isImageFile } from "./assetIngest";

describe("assetIngest", () => {
  it("writes dropped images to the attachments folder and returns image markdown", async () => {
    const writeAttachment = vi.fn().mockResolvedValue({ path: "/vault/attachments/logo.png", relativePath: "attachments/logo.png" });

    await expect(
      ingestDroppedImage(new File(["image-bytes"], "logo.png", { type: "image/png" }), { writeAttachment }),
    ).resolves.toBe("![logo](attachments/logo.png)");

    expect(writeAttachment).toHaveBeenCalledWith({
      bytes: Array.from(new TextEncoder().encode("image-bytes")),
      suggestedName: "logo.png",
      vaultRelDir: "attachments",
    });
  });

  it("detects image files by mime type or extension", () => {
    expect(isImageFile(new File([""], "clipboard", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File([""], "photo.webp", { type: "" }))).toBe(true);
    expect(isImageFile(new File([""], "note.txt", { type: "text/plain" }))).toBe(false);
  });
});
