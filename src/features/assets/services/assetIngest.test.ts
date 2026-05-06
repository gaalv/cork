import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";

import { ingestDroppedImage, ingestPastedImage, isImageFile } from "./assetIngest";

describe("assetIngest", () => {
  beforeEach(() => {
    useAppSettingsStore.setState({ attachmentsFolder: undefined });
  });

  it("writes dropped images to the default attachments folder and returns image markdown", async () => {
    const writeAttachment = vi.fn().mockResolvedValue({ path: "/vault/_attachments/logo.png", relativePath: "_attachments/logo.png" });

    await expect(
      ingestDroppedImage(new File(["image-bytes"], "logo.png", { type: "image/png" }), { writeAttachment }),
    ).resolves.toBe("![logo](_attachments/logo.png)");

    expect(writeAttachment).toHaveBeenCalledWith({
      bytes: Array.from(new TextEncoder().encode("image-bytes")),
      suggestedName: "logo.png",
      vaultRelDir: "_attachments",
    });
  });

  it("writes pasted images with a timestamped filename and empty alt text", async () => {
    const writeAttachment = vi.fn().mockResolvedValue({
      path: "/vault/_attachments/Pasted Image 20260506123456.png",
      relativePath: "_attachments/Pasted%20Image%2020260506123456.png",
    });

    await expect(
      ingestPastedImage(new File(["paste"], "image.png", { type: "image/png" }), {
        now: () => new Date(2026, 4, 6, 12, 34, 56),
        writeAttachment,
      }),
    ).resolves.toBe("![](_attachments/Pasted%20Image%2020260506123456.png)");

    expect(writeAttachment).toHaveBeenCalledWith({
      bytes: Array.from(new TextEncoder().encode("paste")),
      suggestedName: "Pasted Image 20260506123456.png",
      vaultRelDir: "_attachments",
    });
  });

  it("honors per-vault attachments folder overrides", async () => {
    const writeAttachment = vi.fn().mockResolvedValue({ path: "/vault/media/logo.png", relativePath: "media/logo.png" });
    useAppSettingsStore.setState({ attachmentsFolder: "media" });

    await ingestDroppedImage(new File(["image-bytes"], "logo.png", { type: "image/png" }), { writeAttachment });

    expect(writeAttachment).toHaveBeenCalledWith(expect.objectContaining({ vaultRelDir: "media" }));
  });

  it("honors empty attachments folder as same-folder mode", async () => {
    const writeAttachment = vi.fn().mockResolvedValue({ path: "/vault/logo.png", relativePath: "logo.png" });
    useAppSettingsStore.setState({ attachmentsFolder: "" });

    await ingestDroppedImage(new File(["image-bytes"], "logo.png", { type: "image/png" }), { writeAttachment });

    expect(writeAttachment).toHaveBeenCalledWith(expect.objectContaining({ vaultRelDir: "" }));
  });

  it("detects image files by mime type or extension", () => {
    expect(isImageFile(new File([""], "clipboard", { type: "image/png" }))).toBe(true);
    expect(isImageFile(new File([""], "photo.webp", { type: "" }))).toBe(true);
    expect(isImageFile(new File([""], "note.txt", { type: "text/plain" }))).toBe(false);
  });
});
