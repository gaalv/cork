import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useDrawersStore } from "@/features/drawers/state/drawersStore";
import { useShellStore } from "@/features/shell/state/shellStore";

import { TagPills } from "./TagPills";

beforeEach(() => {
  useShellStore.getState().reset();
  useDrawersStore.getState().reset();
});

describe("TagPills", () => {
  it("opens the tags drawer and selects a tag", () => {
    render(<TagPills tags={[{ tag: "dev", count: 3 }]} />);

    fireEvent.click(screen.getByRole("button", { name: /dev/ }));

    expect(useDrawersStore.getState().selectedTag).toBe("dev");
    expect(useShellStore.getState().drawer).toBe("tags");
  });

  it("hides when there are no tags", () => {
    const { container } = render(<TagPills tags={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
