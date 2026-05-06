import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { HomeHero } from "./HomeHero";
import { greetingForHour } from "./homeGreeting";
import { HomeSkeletons } from "./Skeletons";

beforeEach(() => {
  useShellStore.getState().reset();
  useVaultStore.setState({ openVault: vi.fn().mockResolvedValue(undefined) });
});

describe("HomeHero", () => {
  it("renders quick actions", () => {
    render(<HomeHero />);

    fireEvent.click(screen.getByRole("button", { name: "Command ⌘K" }));

    expect(screen.getByRole("heading").textContent).toMatch(/Good/);
    expect(useShellStore.getState().paletteOpen).toBe(true);
  });

  it("varies greeting by day part", () => {
    expect(greetingForHour(8)).toBe("Good morning");
    expect(greetingForHour(14)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
  });

  it("renders skeleton placeholders", () => {
    render(<HomeSkeletons />);

    expect(screen.getByRole("status", { name: "Loading home" })).toBeInTheDocument();
  });
});
