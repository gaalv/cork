import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildMonthGrid } from "../services/calendarService";
import { MonthGrid } from "./MonthGrid";

const noop = () => undefined;

describe("MonthGrid", () => {
  it("renders 42 day cells for June 2026", () => {
    const grid = buildMonthGrid(2026, 5); // June 2026
    render(
      <MonthGrid
        grid={grid}
        noteMap={new Map()}
        viewMonth={new Date(2026, 5, 1)}
        selectedDate={null}
        onSelectDay={noop}
      />,
    );
    // 42 day buttons
    expect(screen.getAllByRole("button")).toHaveLength(42);
  });

  it("renders all 7 day-of-week column headers", () => {
    const grid = buildMonthGrid(2026, 5);
    render(
      <MonthGrid
        grid={grid}
        noteMap={new Map()}
        viewMonth={new Date(2026, 5, 1)}
        selectedDate={null}
        onSelectDay={noop}
      />,
    );
    for (const label of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument();
    }
  });

  it("marks selected day cell as pressed", () => {
    const grid = buildMonthGrid(2026, 5);
    const selected = new Date(2026, 5, 4);
    render(
      <MonthGrid
        grid={grid}
        noteMap={new Map()}
        viewMonth={new Date(2026, 5, 1)}
        selectedDate={selected}
        onSelectDay={noop}
      />,
    );
    const pressedButtons = screen.getAllByRole("button", { pressed: true });
    expect(pressedButtons).toHaveLength(1);
    expect(pressedButtons[0]).toHaveTextContent("4");
  });
});
