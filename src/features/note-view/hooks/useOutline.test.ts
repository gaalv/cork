import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOutline } from "./useOutline";
import { deriveOutline } from "../worker/outlineWorker";

describe("useOutline", () => {
  it("derives markdown headings", () => {
    expect(deriveOutline("# Title\nBody\n## Child")).toEqual([
      { id: "1-title", depth: 1, text: "Title", line: 1 },
      { id: "3-child", depth: 2, text: "Child", line: 3 },
    ]);
  });

  it("updates when markdown changes", async () => {
    const { result, rerender } = renderHook(({ markdown }) => useOutline(markdown), {
      initialProps: { markdown: "# One" },
    });

    rerender({ markdown: "# Two" });

    await waitFor(() => expect(result.current[0]?.text).toBe("Two"));
  });
});
