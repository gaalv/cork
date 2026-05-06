import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppSettingsStore } from "./appSettingsStore";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    vault: {
      settings: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

beforeEach(() => {
  clientMock.vault.settings.mockReset();
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

  it("loads per-vault settings as overrides", async () => {
    clientMock.vault.settings.mockResolvedValue({
      dailyPathPattern: "Journal/YYYY-MM-DD.md",
      attachmentsFolder: "media",
      offlineMode: true,
      autoRewriteLinksOnRename: false,
    });

    await useAppSettingsStore.getState().loadVaultSettings();

    expect(useAppSettingsStore.getState().dailyPathPattern).toBe("Journal/YYYY-MM-DD.md");
    expect(useAppSettingsStore.getState().attachmentsFolder).toBe("media");
    expect(useAppSettingsStore.getState().offlineMode).toBe(true);
    expect(useAppSettingsStore.getState().autoRewriteLinksOnRename).toBe(false);
  });
});
