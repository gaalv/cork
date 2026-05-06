import { describe, expect, it } from "vitest";

import { summarizeBulkResult } from "./bulkOps";

describe("bulkOps", () => {
  it("summarizes partial results", () => {
    expect(summarizeBulkResult({ ok: ["a.md"], failed: [] })).toBe("1 item updated");
    expect(
      summarizeBulkResult({
        ok: ["a.md", "b.md"],
        failed: [{ path: "c.md", error: { kind: "Conflict", currentMtime: 0 } }],
      }),
    ).toBe("2 updated, 1 failed");
  });
});
