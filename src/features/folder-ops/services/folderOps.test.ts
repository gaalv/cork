import { describe, expect, it } from "vitest";

import { validateFolderName } from "./folderOps";

describe("folderOps", () => {
  it("validates folder names like the Rust IPC boundary", () => {
    expect(validateFolderName("Projects")).toBeNull();
    expect(validateFolderName(".hidden")).toMatch(/Hidden/);
    expect(validateFolderName("bad/name")).toMatch(/reserved/);
  });
});
