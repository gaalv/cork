import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/sample");
const sampleNotes = [
  {
    id: "sample-welcome",
    path: path.join(fixturePath, "Welcome.md"),
    title: "Welcome to Noxe",
    folder: "",
    size: 56,
    mtime: Date.UTC(2026, 4, 6, 12, 0),
  },
  {
    id: "sample-roadmap",
    path: path.join(fixturePath, "projects/Roadmap.md"),
    title: "Roadmap Notes",
    folder: "projects",
    size: 43,
    mtime: Date.UTC(2026, 4, 6, 11, 0),
  },
  {
    id: "sample-daily",
    path: path.join(fixturePath, "daily/2026-05-06.md"),
    title: "Daily Sample",
    folder: "daily",
    size: 36,
    mtime: Date.UTC(2026, 4, 6, 10, 0),
  },
];

test("opens a fixture vault and lists sample files in Recents", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open Vault" }).first().click();
  await page.evaluate(
    ({ vaultPath, notes }) => window.__noxe_test_setVault?.(vaultPath, notes),
    { vaultPath: fixturePath, notes: sampleNotes },
  );
  await page.locator('[data-testid="rail"]').getByRole("button", { name: "Recent" }).click();

  await expect(page.getByText("Welcome to Noxe").first()).toBeVisible({ timeout: 2_000 });
  await expect(page.getByText("Roadmap Notes").first()).toBeVisible();
  await expect(page.getByText("Daily Sample").first()).toBeVisible();
});
