import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { dateToISO } from "../services/calendarService";
import { DayCell } from "./DayCell";

const noop = () => undefined;
const june4 = new Date(2026, 5, 4);

describe("DayCell", () => {
  it("renders the day number", () => {
    render(
      <DayCell date={june4} isToday={false} isCurrentMonth={true} isSelected={false} notes={[]} onClick={noop} />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("4");
  });

  it("carries the data-date attribute with the ISO date", () => {
    render(
      <DayCell date={june4} isToday={false} isCurrentMonth={true} isSelected={false} notes={[]} onClick={noop} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-date", dateToISO(june4));
  });

  it("does not show a dot when no notes", () => {
    render(
      <DayCell date={june4} isToday={false} isCurrentMonth={true} isSelected={false} notes={[]} onClick={noop} />,
    );
    expect(screen.getByRole("button").querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
  });

  it("shows a dot indicator when notes exist", () => {
    render(
      <DayCell
        date={june4}
        isToday={false}
        isCurrentMonth={true}
        isSelected={false}
        notes={[{ id: "n1", path: "/vault/d.md", title: "Daily" }]}
        onClick={noop}
      />,
    );
    expect(screen.getByRole("button").querySelectorAll("[aria-hidden='true']")).toHaveLength(1);
  });

  it("applies aria-pressed=true when selected", () => {
    render(
      <DayCell date={june4} isToday={false} isCurrentMonth={true} isSelected={true} notes={[]} onClick={noop} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("applies aria-pressed=false when not selected", () => {
    render(
      <DayCell date={june4} isToday={false} isCurrentMonth={true} isSelected={false} notes={[]} onClick={noop} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onClick when clicked", () => {
    let called = false;
    render(
      <DayCell date={june4} isToday={false} isCurrentMonth={true} isSelected={false} notes={[]} onClick={() => { called = true; }} />,
    );
    screen.getByRole("button").click();
    expect(called).toBe(true);
  });
});
