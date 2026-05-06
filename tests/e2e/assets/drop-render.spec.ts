import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

type WriteAttachmentInput = {
  bytes?: number[];
  suggestedName: string;
  vaultRelDir?: string;
};

type TestWindow = Window & {
  __noxeNodeWriteAttachment?: (input: WriteAttachmentInput) => Promise<{ path: string; relativePath: string }>;
};

const vaultPath = path.resolve("test-results/f11-assets-vault");
const notePath = path.join(vaultPath, "Drop Render.md");

test.beforeEach(async ({ page }) => {
  fs.rmSync(vaultPath, { recursive: true, force: true });
  fs.mkdirSync(vaultPath, { recursive: true });

  await page.exposeFunction("__noxeNodeWriteAttachment", async (input: WriteAttachmentInput) => {
    const relativeDir = input.vaultRelDir ?? "_attachments";
    const destinationDir = path.join(vaultPath, relativeDir);
    fs.mkdirSync(destinationDir, { recursive: true });
    const destinationPath = path.join(destinationDir, input.suggestedName);
    fs.writeFileSync(destinationPath, Buffer.from(input.bytes ?? []));
    return {
      path: destinationPath,
      relativePath: path.posix.join(relativeDir, input.suggestedName),
    };
  });
});

test("drops an image into the editor and renders it in preview", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ note, vault }) => {
      window.__noxe_test_writeAttachment = (input) =>
        (window as TestWindow).__noxeNodeWriteAttachment?.(input) ?? Promise.reject(new Error("missing test writer"));
      window.__noxe_test_setVault?.(vault, [
        { id: "drop-render", path: note, title: "Drop Render", folder: "", size: 1, mtime: 1 },
      ]);
    },
    { note: notePath, vault: vaultPath },
  );

  await page.getByRole("button", { name: /Drop Render/ }).first().click();
  const editor = page.getByRole("textbox");
  await expect(editor).toBeVisible();

  const dataTransfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], "pixel.png", { type: "image/png" }));
    return transfer;
  });
  await editor.dispatchEvent("drop", { dataTransfer });

  await expect(editor).toContainText("![pixel](_attachments/pixel.png)");
  expect(fs.existsSync(path.join(vaultPath, "_attachments", "pixel.png"))).toBe(true);

  const image = page.getByRole("img", { name: "pixel" });
  await expect(image).toHaveAttribute("loading", "lazy");
  await expect(image).toHaveAttribute("src", /asset:\/\/localhost\/.*_attachments\/pixel\.png/);
});
