import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCalendarStore } from "../state/calendarStore";
import { useShellStore } from "@/features/shell/state/shellStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { CalendarView } from "./CalendarView";

const { clientMock } = vi.hoisted(() => ({
  clientMock: {
    notes: {
      create: vi.fn(),
      save: vi.fn(),
    },
  },
}));

vi.mock("@/shared/ipc/client", () => ({ client: clientMock }));

const dailyNote = {
  id: "daily-1",
  path: "/vault/Daily/2026/06/2026-06-04.md",
  title: "2026-06-04",
  folder: "Daily/2026/06",
  size: 1,
  mtime: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  useShellStore.getState().reset();
  useVaultStore.setState({ path: "/vault", notes: [], isLoading: false, error: null, loadNotes: vi.fn().mockResolvedValue(undefined) });
  // Reset calendar store to a fixed month: June 2026
  useCalendarStore.setState({
    viewMonth: new Date(2026, 5, 1),
    selectedDate: null,
  });
});

describe("CalendarView", () => {
  it("renders the calendar view with month name", () => {
    render(<CalendarView />);
    expect(screen.getByTestId("calendar-view")).toBeInTheDocument();
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("shows Previous month and Next month navigation buttons", () => {
    render(<CalendarView />);
    expect(screen.getByRole("button", { name: "Previous month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
  });

  it("clicking Next month advances to July 2026", () => {
    render(<CalendarView />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("clicking Previous month goes to May 2026", () => {
    render(<CalendarView />);
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("clicking Today resets to current month", () => {
    render(<CalendarView />);
    // Move away first
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    // Click today
    fireEvent.click(screen.getByRole("button", { name: /Today/ }));
    const now = new Date();
    const monthName = now.toLocaleString("default", { month: "long" });
    expect(screen.getByText(`${monthName} ${now.getFullYear()}`)).toBeInTheDocument();
  });

  it("does not show agenda panel when no date is selected", () => {
    render(<CalendarView />);
    expect(screen.queryByTestId("agenda-panel")).not.toBeInTheDocument();
  });

  it("clicking a day without a daily note opens the agenda panel", () => {
    const { container } = render(<CalendarView />);
    const dayBtn = container.querySelector('[data-date="2026-06-01"]') as HTMLElement;
    fireEvent.click(dayBtn);
    expect(screen.getByTestId("agenda-panel")).toBeInTheDocument();
  });

  it("clicking a day with a daily note navigates to the note", () => {
    useVaultStore.setState({ notes: [dailyNote] });
    const { container } = render(<CalendarView />);
    const dayBtn = container.querySelector('[data-date="2026-06-04"]') as HTMLElement;
    fireEvent.click(dayBtn);
    expect(useShellStore.getState().view).toEqual({ kind: "note", id: "daily-1" });
  });

  it("agenda panel shows Create daily note button when no daily note", () => {
    const { container } = render(<CalendarView />);
    const dayBtn = container.querySelector('[data-date="2026-06-01"]') as HTMLElement;
    fireEvent.click(dayBtn);
    expect(screen.getByRole("button", { name: /Create daily note/ })).toBeInTheDocument();
  });

  it("closing agenda panel via close button deselects the date", () => {
    const { container } = render(<CalendarView />);
    const dayBtn = container.querySelector('[data-date="2026-06-01"]') as HTMLElement;
    fireEvent.click(dayBtn);
    expect(screen.getByTestId("agenda-panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close agenda" }));
    expect(screen.queryByTestId("agenda-panel")).not.toBeInTheDocument();
  });

  it("pressing Escape deselects the date when one is selected", () => {
    const { container } = render(<CalendarView />);
    const dayBtn = container.querySelector('[data-date="2026-06-01"]') as HTMLElement;
    fireEvent.click(dayBtn);
    expect(screen.getByTestId("agenda-panel")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("agenda-panel")).not.toBeInTheDocument();
    // view is still "home" since we only deselected, didn't navigate
    expect(useShellStore.getState().view).toEqual({ kind: "home" });
  });

  it("pressing Escape with no selected date navigates home", () => {
    useCalendarStore.setState({ selectedDate: null });
    render(<CalendarView />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useShellStore.getState().view).toEqual({ kind: "home" });
  });
});
