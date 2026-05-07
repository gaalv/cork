import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultStore } from "@/features/vault/state/vaultStore";

import { HomeHero } from "./HomeHero";
import { greetingForHour } from "./homeGreeting";
import { HomeSkeletons } from "./Skeletons";

beforeEach(() => {
  useVaultStore.setState({ notes: [], openVault: vi.fn().mockResolvedValue(undefined) });
});

describe("HomeHero", () => {
  it("greets and shows today's date", () => {
    render(<HomeHero />);

    expect(screen.getByRole("heading").textContent).toMatch(/Good/);
    // Date label includes the current year
    expect(screen.getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it("nudges when inbox notes are stale", () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    useVaultStore.setState({
      notes: [
        { id: "n1", path: "/v/a.md", title: "A", folder: "", size: 1, mtime: yesterday },
        { id: "n2", path: "/v/b.md", title: "B", folder: "", size: 1, mtime: yesterday },
      ],
    });

    render(<HomeHero />);
    expect(screen.getByText(/sitting in your Inbox/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
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
