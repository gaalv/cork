import { describe, expect, it } from "vitest";

import { resolveAssetSrc } from "./assetResolver";

describe("resolveAssetSrc", () => {
  const vault = "/vault";
  const note = "/vault/notes/today.md";

  it("resolves a relative image against the current note folder", () => {
    expect(resolveAssetSrc("image.png", note, vault)).toMatchObject({
      status: "resolved",
      path: "/vault/notes/image.png",
      url: "asset://localhost//vault/notes/image.png",
    });
  });

  it("resolves a parent-relative asset inside the vault", () => {
    expect(resolveAssetSrc("../assets/logo.png", note, vault)).toMatchObject({
      status: "resolved",
      path: "/vault/assets/logo.png",
    });
  });

  it("resolves an absolute path inside the vault", () => {
    expect(resolveAssetSrc("/vault/assets/logo.png", note, vault)).toMatchObject({
      status: "resolved",
      path: "/vault/assets/logo.png",
    });
  });

  it("blocks traversal outside the vault", () => {
    expect(resolveAssetSrc("../../secret.png", note, vault)).toEqual({
      status: "blocked",
      reason: "outside-vault",
      path: "/secret.png",
    });
  });

  it("marks existing-check failures as missing", () => {
    expect(resolveAssetSrc("missing.png", note, vault, { exists: () => false })).toEqual({
      status: "missing",
      path: "/vault/notes/missing.png",
    });
  });

  it("keeps remote URLs unchanged", () => {
    expect(resolveAssetSrc("https://example.com/logo.png", note, vault)).toEqual({
      status: "resolved",
      path: "https://example.com/logo.png",
      url: "https://example.com/logo.png",
    });
  });

  it("blocks unsupported URL protocols", () => {
    expect(resolveAssetSrc("file:///etc/passwd", note, vault)).toEqual({
      status: "blocked",
      reason: "unsupported-url",
      path: "file:///etc/passwd",
    });
  });

  it("encodes spaces and unicode path segments", () => {
    const result = resolveAssetSrc("My Logo æ.png", note, vault);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.url).toBe("asset://localhost//vault/notes/My%20Logo%20%C3%A6.png");
    }
  });

  it("allows a custom URL builder", () => {
    expect(resolveAssetSrc("image.png", note, vault, { toUrl: (path) => `custom:${path}` })).toMatchObject({
      url: "custom:/vault/notes/image.png",
    });
  });
});
