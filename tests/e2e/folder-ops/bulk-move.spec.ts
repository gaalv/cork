import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/sample");
const notes = [
  { id: "welcome", path: path.join(fixturePath, "Welcome.md"), title: "Welcome", folder: "", size: 1, mtime: Date.UTC(2026, 4, 6) },
  { id: "roadmap", path: path.join(fixturePath, "projects/Roadmap.md"), title: "Roadmap", folder: "projects", size: 1, mtime: Date.UTC(2026, 4, 6) },
  { id: "daily", path: path.join(fixturePath, "daily/Today.md"), title: "Today", folder: "daily", size: 1, mtime: Date.UTC(2026, 4, 6) },
];

test("selects multiple notes and opens bulk move picker", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(({ vaultPath, fixtureNotes }) => window.__noxe_test_setVault?.(vaultPath, fixtureNotes), {
    vaultPath: fixturePath,
    fixtureNotes: notes,
  });

  const allNotes = page.locator('section[aria-labelledby="home-all-notes-heading"]');
  await page.keyboard.down("Meta");
  await allNotes.getByRole("button", { name: /Welcome/i }).first().click();
  await allNotes.getByRole("button", { name: /Roadmap/i }).first().click();
  await page.keyboard.up("Meta");

  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Move…" }).click();
  await expect(page.getByRole("dialog", { name: "Move to folder" })).toBeVisible();
});
