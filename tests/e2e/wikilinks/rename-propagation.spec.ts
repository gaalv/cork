import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/wikilinks");
const notes = [
  {
    id: "source",
    path: path.join(fixturePath, "Source.md"),
    title: "Source",
    folder: "",
    size: 1,
    mtime: Date.UTC(2026, 4, 6),
    body: "# Source\n\nSee [[Renamed]].",
  },
  {
    id: "renamed",
    path: path.join(fixturePath, "Renamed.md"),
    title: "Renamed",
    folder: "",
    size: 1,
    mtime: Date.UTC(2026, 4, 6),
    body: "# Renamed\n",
  },
];

test("renamed wikilink preview navigates to the new target", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(({ vaultPath, fixtureNotes }) => window.__noxe_test_setVault?.(vaultPath, fixtureNotes), {
    vaultPath: fixturePath,
    fixtureNotes: notes,
  });

  await page.getByRole("button", { name: "Source Vault" }).click();
  await expect(page.getByTestId("note-view")).toBeVisible();

  const link = page.getByRole("button", { name: "Renamed" }).first();
  await expect(link).toHaveAttribute("data-target-id", "renamed");
  await link.click();

  await expect(page.getByRole("heading", { name: "Renamed" }).first()).toBeVisible();
});
