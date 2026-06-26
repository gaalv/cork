import { expect, test } from "@playwright/test";

const vaultA = "/vault-a";
const vaultB = "/vault-b";
const alphaPath = `${vaultA}/Alpha.md`;
const betaPath = `${vaultB}/Beta.md`;

test("preserves unsaved edits through failed and rapid vault switches", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ aPath, bPath, alpha }) => {
      window.__cork_test_setVault?.(aPath, [{ id: "alpha", path: alpha, title: "Alpha", folder: "", snippet: "", size: 1, mtime: 1 }]);
      window.__cork_test_setRecentVaults?.([
        { path: aPath, name: "vault-a", missing: false },
        { path: bPath, name: "vault-b", missing: false },
      ]);
    },
    { aPath: vaultA, bPath: vaultB, alpha: alphaPath },
  );

  await page.getByRole("button", { name: /Alpha/ }).first().click();
  const editor = page.getByRole("textbox");
  await expect(editor).toBeVisible();
  const typed = `# Alpha\n${"x".repeat(100)}`;
  await editor.fill(typed);

  await page.getByTestId("topbar").getByRole("button", { name: /Home/ }).click();
  await page.getByRole("button", { name: /Vault: vault-a/ }).click();
  await page.getByRole("button", { name: /vault-b/ }).click();

  await page.getByRole("button", { name: /Alpha/ }).first().click();
  await expect(page.getByRole("textbox")).toContainText("x".repeat(100));

  await page.evaluate(
    ({ bPath, beta }) => {
      window.__cork_test_setVault?.(bPath, [{ id: "beta", path: beta, title: "Beta", folder: "", snippet: "", size: 1, mtime: 1 }]);
    },
    { bPath: vaultB, beta: betaPath },
  );
  await expect(page.getByRole("button", { name: /Beta/ }).first()).toBeVisible();

  await page.evaluate(
    ({ aPath, alpha, body }) => {
      type FixtureNote = { id: string; path: string; title: string; folder: string; snippet: string; size: number; mtime: number; body?: string };
      const note: FixtureNote = { id: "alpha", path: alpha, title: "Alpha", folder: "", snippet: "", size: body.length, mtime: 2, body };
      window.__cork_test_setVault?.(aPath, [note]);
    },
    { aPath: vaultA, alpha: alphaPath, body: typed },
  );
  await page.getByRole("button", { name: /Alpha/ }).first().click();
  await expect(page.getByRole("textbox")).toContainText("x".repeat(100));
});
