import { describe, expect, it, vi } from "vitest";

import { ingestDroppedImage, ingestPastedImage, isImageFile } from "./assetIngest";

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

  it("writes pasted images with a timestamped filename and empty alt text", async () => {
    const writeAttachment = vi.fn().mockResolvedValue({
      path: "/vault/attachments/Pasted Image 20260506123456.png",
      relativePath: "attachments/Pasted%20Image%2020260506123456.png",
    });

    await expect(
      ingestPastedImage(new File(["paste"], "image.png", { type: "image/png" }), {
        now: () => new Date(2026, 4, 6, 12, 34, 56),
        writeAttachment,
      }),
    ).resolves.toBe("![](attachments/Pasted%20Image%2020260506123456.png)");

    expect(writeAttachment).toHaveBeenCalledWith({
      bytes: Array.from(new TextEncoder().encode("paste")),
      suggestedName: "Pasted Image 20260506123456.png",
      vaultRelDir: "attachments",
    });
  });

  it("detects image files by mime type or extension", () => {
    expect(isImageFile(new File([""], "clipboard", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File([""], "photo.webp", { type: "" }))).toBe(true);
    expect(isImageFile(new File([""], "note.txt", { type: "text/plain" }))).toBe(false);
  });
});
