import { expect, test } from "@playwright/test";

test("keeps local editor text through simulated external-change chaos", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.__noxe_test_setVault?.("/vault", [
      { id: "n1", path: "/vault/chaos.md", title: "Chaos", folder: "", size: 1, mtime: 1 },
    ]);
  });

  await page.getByRole("button", { name: /Chaos/ }).first().click();
  const editor = page.getByRole("textbox");
  await expect(editor).toBeVisible();

  const typed = "x".repeat(100);
  await editor.fill(`# Chaos\n${typed}`);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: ".", metaKey: true }));
  });

  await expect(editor).toContainText(typed);
});
