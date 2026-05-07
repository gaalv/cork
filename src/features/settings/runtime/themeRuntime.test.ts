import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppSettingsStore } from "@/features/settings/state/appSettingsStore";
import { __test__, installThemeRuntime, resolveActiveTheme } from "./themeRuntime";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    settings: {
      appLoad: vi.fn(),
      appSave: vi.fn(),
      vaultLoad: vi.fn(),
      vaultSave: vi.fn(),
    },
    vault: { settings: vi.fn() },
  },
}));

vi.mock("@/shared/ipc/client", () => ({
  client: clientMock,
}));

type Listener = (event: MediaQueryListEvent) => void;

function installMatchMediaStub(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialMatches,
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    addListener: (l: Listener) => listeners.add(l),
    removeListener: (l: Listener) => listeners.delete(l),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => mql,
  });

  return {
    set(matches: boolean) {
      (mql as { matches: boolean }).matches = matches;
      const event = { matches } as MediaQueryListEvent;
      for (const l of listeners) l(event);
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  useAppSettingsStore.getState().reset();
  __test__.reset();
});

describe("themeRuntime", () => {
  it("resolves system preference when theme is 'system'", async () => {
    const mql = installMatchMediaStub(true);
    const dispose = installThemeRuntime();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(resolveActiveTheme()).toBe("dark");

    mql.set(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(resolveActiveTheme()).toBe("light");

    dispose();
  });

  it("applies explicit theme regardless of system preference", async () => {
    installMatchMediaStub(true);
    const dispose = installThemeRuntime();

    await useAppSettingsStore.getState().updateSettings({
      appearance: { ...useAppSettingsStore.getState().settings.appearance, theme: "light" },
    });

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(resolveActiveTheme()).toBe("light");

    await useAppSettingsStore.getState().updateSettings({
      appearance: { ...useAppSettingsStore.getState().settings.appearance, theme: "dark" },
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(resolveActiveTheme()).toBe("dark");

    dispose();
  });

  it("disposer unsubscribes both store and media query", async () => {
    const mql = installMatchMediaStub(false);
    const dispose = installThemeRuntime();

    dispose();
    mql.set(true);
    expect(resolveActiveTheme()).toBe("light"); // should not have updated

    await useAppSettingsStore.getState().updateSettings({
      appearance: { ...useAppSettingsStore.getState().settings.appearance, theme: "dark" },
    });
    expect(resolveActiveTheme()).toBe("light"); // store change ignored after dispose
  });
});
