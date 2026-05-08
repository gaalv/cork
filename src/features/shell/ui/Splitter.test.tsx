import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Splitter } from "./Splitter";

describe("Splitter", () => {
  it("renders one panel per child with N-1 handles", () => {
    render(
      <Splitter
        panels={[
          { id: "a", size: 200, min: 100, max: 400 },
          { id: "b", size: 300, min: 100, max: 600 },
          { id: "c", size: "fill" },
        ]}
      >
        <div data-testid="pane-a">A</div>
        <div data-testid="pane-b">B</div>
        <div data-testid="pane-c">C</div>
      </Splitter>,
    );
    expect(screen.getByTestId("pane-a")).toBeTruthy();
    expect(screen.getByTestId("pane-b")).toBeTruthy();
    expect(screen.getByTestId("pane-c")).toBeTruthy();
    expect(screen.getByTestId("splitter-handle-0")).toBeTruthy();
    expect(screen.getByTestId("splitter-handle-1")).toBeTruthy();
  });

  it("clamps to max on ArrowRight when exceeding bounds and reports onResize", () => {
    const onResize = vi.fn();
    render(
      <Splitter
        panels={[
          { id: "a", size: 200, min: 100, max: 250 },
          { id: "b", size: "fill" },
        ]}
        onResize={onResize}
        step={100}
      >
        <div>A</div>
        <div>B</div>
      </Splitter>,
    );
    const handle = screen.getByTestId("splitter-handle-0");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onResize).toHaveBeenLastCalledWith({ a: 250 });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onResize).toHaveBeenLastCalledWith({ a: 100 });
  });
});
