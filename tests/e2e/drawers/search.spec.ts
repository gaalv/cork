import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/sample");
const notes = [
  {
    id: "react-note",
    path: path.join(fixturePath, "React.md"),
    title: "React Patterns",
    folder: "work",
    size: 1,
    mtime: Date.UTC(2026, 4, 6, 12, 0),
  },
  {
    id: "rust-note",
    path: path.join(fixturePath, "Rust.md"),
    title: "Rust Notes",
    folder: "work",
    size: 1,
    mtime: Date.UTC(2026, 4, 6, 11, 0),
  },
];

test("opens search drawer, searches, and navigates to a result", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(({ vaultPath, fixtureNotes }) => window.__noxe_test_setVault?.(vaultPath, fixtureNotes), {
    vaultPath: fixturePath,
    fixtureNotes: notes,
  });

  await page.locator('[data-testid="rail"]').getByRole("button", { name: "Search" }).click();
  const drawer = page.getByRole("region", { name: "Search" });
  await drawer.getByLabel("Search notes").fill("react");
  await drawer.getByRole("button", { name: /React Patterns/i }).click();

  await expect(page.getByTestId("note-view")).toContainText("React Patterns");
});
