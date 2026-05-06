import { expect, test } from "@playwright/test";

test("Noxe app boots and renders the Layout C shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Noxe");
  await expect(page.locator('[data-testid="rail"]')).toBeVisible();
  await expect(page.locator('[data-testid="topbar"]')).toBeVisible();
  await expect(page.locator('[data-testid="shell"]')).toBeVisible();
});
