import path from "node:path";

import { expect, test } from "@playwright/test";

const fixturePath = path.resolve("tests/fixtures/vaults/sample");
const notePath = path.join(fixturePath, "Home Pin.md");
const notes = [
  { id: "pin-note", path: notePath, title: "Home Pin", folder: "", snippet: "", size: 1, mtime: Date.UTC(2026, 4, 6, 12, 0) },
];

test("pins and unpins a note from Home", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ vaultPath, fixtureNotes, pathToNote }) => {
      const files = new Map<string, { path: string; frontmatter: Record<string, boolean>; body: string; mtime: number }>([
        [pathToNote, { path: pathToNote, frontmatter: {}, body: "# Home Pin\nPinned flow", mtime: 1 }],
      ]);
      window.__cork_test_setVault?.(vaultPath, fixtureNotes);
      window.__cork_test_readNote = (pathName) => files.get(pathName) ?? null;
      window.__cork_test_togglePin = (pathName) => {
        const file = files.get(pathName);
        if (!file) {
          return false;
        }
        const pinned = file.frontmatter.pinned !== true;
        files.set(pathName, { ...file, frontmatter: { ...file.frontmatter, pinned }, mtime: file.mtime + 1 });
        return pinned;
      };
    },
    { vaultPath: fixturePath, fixtureNotes: notes, pathToNote: notePath },
  );

  await expect(page.getByRole("heading", { name: "Browse vault" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu for Home Pin" }).click();
  await page.getByRole("menuitem", { name: "Pin" }).click();

  const pinnedSection = page.getByRole("region", { name: "Start here" });
  await expect(pinnedSection.getByRole("button", { name: /Home Pin/ }).first()).toBeVisible();

  await pinnedSection.getByRole("button", { name: "Open menu for Home Pin" }).click();
  await page.getByRole("menuitem", { name: "Unpin" }).click();
  await expect(pinnedSection.getByText("Pin important notes")).toBeVisible();
});
