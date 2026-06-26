import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/sample");
const notes = [
  { id: "root", path: path.join(fixturePath, "Welcome.md"), title: "Welcome", folder: "", snippet: "", size: 1, mtime: Date.UTC(2026, 4, 6) },
  { id: "project", path: path.join(fixturePath, "projects/Roadmap.md"), title: "Roadmap", folder: "projects", snippet: "", size: 1, mtime: Date.UTC(2026, 4, 6) },
];

test("opens folder context menu and inline rename", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(({ vaultPath, fixtureNotes }) => window.__cork_test_setVault?.(vaultPath, fixtureNotes), {
    vaultPath: fixturePath,
    fixtureNotes: notes,
  });

  await page.locator('[data-testid="rail"]').getByRole("button", { name: "Folders" }).click();
  await page.getByRole("button", { name: "projects 1" }).click();

  await expect(page.getByLabel(/Rename projects/i)).toBeVisible();
});
