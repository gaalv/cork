import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { useShortcuts } from "./useShortcuts";

function Harness() {
  useShortcuts();
  return <input aria-label="Editor" />;
}

beforeEach(() => {
  useShellStore.getState().reset();
  useVaultStore.setState({ openVault: vi.fn().mockResolvedValue(undefined) });
});

describe("useShortcuts", () => {
  it("opens the palette with mod+k even from inputs", () => {
    render(<Harness />);
    const input = document.querySelector("input");
    input?.focus();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));

    expect(useShellStore.getState().paletteOpen).toBe(true);
  });

  it("skips non-palette shortcuts from editable targets", () => {
    render(<Harness />);
    const input = document.querySelector("input");
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN", ctrlKey: true, bubbles: true }));

    expect(useShellStore.getState().view).toEqual({ kind: "home" });
  });

  it("handles drawer toggle and help shortcuts", () => {
    render(<Harness />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "\\", code: "Backslash", ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", code: "Slash", shiftKey: true, bubbles: true }));

    expect(useShellStore.getState().drawer).toBe("search");
    expect(useShellStore.getState().helpOpen).toBe(true);
  });
});
