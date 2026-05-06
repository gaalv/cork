import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useScrollSpy } from "./useScrollSpy";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useScrollSpy", () => {
  it("defaults to the first heading id", () => {
    const { result } = renderHook(() => useScrollSpy(["intro", "details"]));

    expect(result.current).toBe("intro");
  });

  it("returns null without headings", () => {
    const { result } = renderHook(() => useScrollSpy([]));

    expect(result.current).toBeNull();
  });
});
