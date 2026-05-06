import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "./shellStore";

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  useShellStore.getState().reset();
});

describe("shellStore", () => {
  it("navigates and bounds back/forward history", () => {
    const store = useShellStore.getState();

    store.navigate({ kind: "note", id: "n1" });
    store.navigate({ kind: "note", id: "n2" });
    useShellStore.getState().back();
    useShellStore.getState().back();
    useShellStore.getState().back();

    expect(useShellStore.getState().view).toEqual({ kind: "home" });

    useShellStore.getState().forward();
    useShellStore.getState().forward();
    useShellStore.getState().forward();

    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "n2" });
  });

  it("toggles drawers and tracks the most recent drawer", () => {
    useShellStore.getState().toggleDrawer("search");
    expect(useShellStore.getState().drawer).toBe("search");

    useShellStore.getState().toggleDrawer("search");
    expect(useShellStore.getState().drawer).toBeNull();
    expect(useShellStore.getState().lastDrawer).toBe("search");

    useShellStore.getState().toggleDrawer("tags");
    expect(useShellStore.getState().drawer).toBe("tags");
    expect(useShellStore.getState().lastDrawer).toBe("tags");
  });

  it("opens and closes the palette", () => {
    useShellStore.getState().openPalette();
    expect(useShellStore.getState().paletteOpen).toBe(true);

    useShellStore.getState().closePalette();
    expect(useShellStore.getState().paletteOpen).toBe(false);
  });

  it("keeps only three toast messages", () => {
    useShellStore.getState().pushToast({ id: "1", title: "One" });
    useShellStore.getState().pushToast({ id: "2", title: "Two" });
    useShellStore.getState().pushToast({ id: "3", title: "Three" });
    useShellStore.getState().pushToast({ id: "4", title: "Four" });

    expect(useShellStore.getState().toasts.map((toast) => toast.id)).toEqual(["4", "3", "2"]);
  });
});
