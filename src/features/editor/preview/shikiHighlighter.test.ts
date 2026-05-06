import { describe, expect, it } from "vitest";

import { highlightCode } from "./shikiHighlighter";

describe("highlightCode", () => {
  it("renders supported development languages with Shiki", async () => {
    await expect(highlightCode("const x: number = 1", "ts")).resolves.toContain("shiki");
    await expect(highlightCode("console.log(x)", "js")).resolves.toContain("shiki");
    await expect(highlightCode("fn main() {}", "rust")).resolves.toContain("shiki");
    await expect(highlightCode("echo hi", "bash")).resolves.toContain("shiki");
  });
});
