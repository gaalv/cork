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
];

test("opens palette and routes from note back to home", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ vaultPath, notes }) => window.__noxe_test_setVault?.(vaultPath, notes),
    { vaultPath: fixturePath, notes: sampleNotes },
  );

  await page.getByRole("button", { name: /Vá para nota/ }).click();
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();

  await page.locator('input[aria-label="Command palette"]').fill("Roadmap");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("note-view")).toContainText("Roadmap Notes");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("home-view")).toBeVisible();
});
