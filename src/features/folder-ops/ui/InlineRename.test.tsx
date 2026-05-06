import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineRename } from "./InlineRename";

describe("InlineRename", () => {
  it("commits with enter", () => {
    const onCommit = vi.fn();
    render(<InlineRename initial="Old" label="Rename folder" onCommit={onCommit} />);

    fireEvent.change(screen.getByLabelText("Rename folder"), { target: { value: "New" } });
    fireEvent.keyDown(screen.getByLabelText("Rename folder"), { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith("New");
  });

  it("cancels with escape", () => {
    const onCancel = vi.fn();
    const onCommit = vi.fn();
    render(<InlineRename initial="Old" label="Rename folder" onCancel={onCancel} onCommit={onCommit} />);

    fireEvent.change(screen.getByLabelText("Rename folder"), { target: { value: "Old draft" } });
    fireEvent.keyDown(screen.getByLabelText("Rename folder"), { key: "Escape" });

    expect(onCancel).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows validation errors", () => {
    const onCommit = vi.fn();
    render(
      <InlineRename
        initial="Old"
        label="Rename folder"
        validate={() => "Invalid name"}
        onCommit={onCommit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Rename folder"), { target: { value: "Bad" } });
    fireEvent.blur(screen.getByLabelText("Rename folder"));

    expect(screen.getByText("Invalid name")).toBeVisible();
    expect(onCommit).not.toHaveBeenCalled();
  });
});
