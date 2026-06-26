import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/sample");

test("Cork app boots and renders the Layout C shell", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((vaultPath) => window.__cork_test_setVault?.(vaultPath, []), fixturePath);

  await expect(page).toHaveTitle("Cork");
  await expect(page.locator('[data-testid="shell"]')).toBeVisible();
  await expect(page.locator('[data-testid="rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"]')).toBeVisible();
});
