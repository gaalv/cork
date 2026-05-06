import { describe, expect, it } from "vitest";

import { assetUrl } from "./assetUrl";

describe("assetUrl", () => {
  it("falls back to an encoded asset protocol URL outside Tauri", () => {
    expect(assetUrl("/vault/My Logo.png")).toBe("asset://localhost//vault/My%20Logo.png");
  });

  it("wraps convertFileSrc when Tauri internals are present", () => {
    const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
    const original = tauriWindow.__TAURI_INTERNALS__;
    tauriWindow.__TAURI_INTERNALS__ = { convertFileSrc: () => "ignored" };

    try {
      expect(assetUrl("/vault/logo.png", (path, protocol) => `${protocol}:${path}`)).toBe("asset:/vault/logo.png");
    } finally {
      tauriWindow.__TAURI_INTERNALS__ = original;
    }
  });
});
