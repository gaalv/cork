import { beforeEach, describe, expect, it, vi } from "vitest";

import { settingsBridge } from "./settingsBridge";
import { DEFAULT_APP_SETTINGS } from "../state/settingsTypes";
import { useAppSettingsStore } from "../state/appSettingsStore";
import { useVaultSettingsStore } from "../state/vaultSettingsStore";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    settings: {
      appLoad: vi.fn(),
      appSave: vi.fn(),
      vaultLoad: vi.fn(),
      vaultSave: vi.fn(),
    },
    vault: {
      settings: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

beforeEach(() => {
  window.localStorage.clear();
  clientMock.settings.appLoad.mockReset();
  clientMock.settings.appSave.mockReset();
  clientMock.settings.vaultLoad.mockReset();
  clientMock.settings.vaultSave.mockReset();
  clientMock.vault.settings.mockReset();
  useAppSettingsStore.getState().reset();
  useVaultSettingsStore.getState().reset();
});

describe("settingsBridge", () => {
  it("resolves global and per-vault defaults", () => {
    expect(settingsBridge.get("appearance.density")).toBe("comfortable");
    expect(settingsBridge.get("vault.attachmentsFolder")).toBe("_attachments");
    expect(settingsBridge.get("wikilinks.autoRewriteOnRename")).toBe(true);
  });

  it("persists global settings and emits changes", async () => {
    clientMock.settings.appSave.mockResolvedValue(DEFAULT_APP_SETTINGS);
    const changed = vi.fn();
    const unsubscribe = settingsBridge.onChanged(changed);

    await settingsBridge.set("editor.autoSaveDebounceMs", 750, "global");

    expect(useAppSettingsStore.getState().settings.editor.autoSaveDebounceMs).toBe(750);
    expect(clientMock.settings.appSave).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith({ key: "editor.autoSaveDebounceMs", scope: "global", value: 750 });
    unsubscribe();
  });

  it("persists per-vault settings", async () => {
    clientMock.settings.vaultSave.mockImplementation(async (settings: unknown) => settings);
    useVaultSettingsStore.setState({ hasVault: true });

    await settingsBridge.set("vault.attachmentsFolder", "media", "vault");

    expect(clientMock.settings.vaultSave).toHaveBeenCalledWith({ attachmentsFolder: "media" });
    expect(settingsBridge.get("vault.attachmentsFolder")).toBe("media");
  });
});
