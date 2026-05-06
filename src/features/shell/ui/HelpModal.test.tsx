import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAppSettingsStore } from "@/features/shell/state/appSettingsStore";
import { useShellStore } from "@/features/shell/state/shellStore";

import { HelpModal } from "./HelpModal";

beforeEach(() => {
  useShellStore.getState().reset();
  useAppSettingsStore.getState().reset();
});

describe("HelpModal", () => {
  it("renders the shortcut reference and auto-rewrite toggle", () => {
    useShellStore.getState().openHelp();

    render(<HelpModal />);

    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    const toggle = screen.getByLabelText("Rewrite wikilinks on rename");
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(useAppSettingsStore.getState().autoRewriteLinksOnRename).toBe(false);
  });
});
