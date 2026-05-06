import { beforeEach, describe, expect, it } from "vitest";

import { useAppSettingsStore } from "./appSettingsStore";

beforeEach(() => {
  window.localStorage.clear();
  useAppSettingsStore.getState().reset();
});

describe("appSettingsStore", () => {
  it("defaults auto rewrite on and persists changes", () => {
    expect(useAppSettingsStore.getState().autoRewriteLinksOnRename).toBe(true);

    useAppSettingsStore.getState().setAutoRewriteLinksOnRename(false);

    expect(useAppSettingsStore.getState().autoRewriteLinksOnRename).toBe(false);
    expect(window.localStorage.getItem("noxe.appSettings")).toContain("false");
  });
});
