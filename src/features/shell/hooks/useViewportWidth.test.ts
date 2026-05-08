import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useViewportWidth } from "./useViewportWidth";

describe("useViewportWidth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current window width on mount", () => {
    const { result } = renderHook(() => useViewportWidth(50));
    expect(result.current).toBe(1280);
  });

  it("updates after a debounced resize event", () => {
    const { result } = renderHook(() => useViewportWidth(50));
    act(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 900 });
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(1280);
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(result.current).toBe(900);
  });

  it("cleans up the listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useViewportWidth(50));
    unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
