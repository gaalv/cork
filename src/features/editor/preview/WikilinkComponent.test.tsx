import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useShellStore } from "@/features/shell/state/shellStore";

import { WikilinkComponent } from "./WikilinkComponent";

const link = {
  srcNoteId: "n1",
  targetText: "Target",
  targetId: "n2",
  position: 7,
  alias: null,
  ambiguous: false,
};

beforeEach(() => {
  useShellStore.getState().reset();
});

describe("WikilinkComponent", () => {
  it("navigates resolved links", () => {
    render(
      <WikilinkComponent target="Target" link={link}>
        Target
      </WikilinkComponent>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Target" }));

    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "n2" });
  });

  it("marks unresolved links and delegates create flow", () => {
    const onUnresolvedClick = vi.fn();
    render(
      <WikilinkComponent target="Missing" onUnresolvedClick={onUnresolvedClick}>
        Missing
      </WikilinkComponent>,
    );

    const button = screen.getByRole("button", { name: "Missing" });
    expect(button).toHaveClass("unresolved");
    fireEvent.click(button);

    expect(onUnresolvedClick).toHaveBeenCalledWith("Missing");
  });
});
