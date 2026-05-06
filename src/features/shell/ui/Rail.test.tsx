import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";

import { Rail } from "./Rail";

beforeEach(() => {
  useShellStore.getState().reset();
});

describe("Rail", () => {
  it("sets the active drawer when a drawer icon is clicked", async () => {
    render(<Rail />);

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(useShellStore.getState().drawer).toBe("search");
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-pressed", "true");
  });
});
