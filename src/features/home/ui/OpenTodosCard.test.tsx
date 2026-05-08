import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OpenTodosCard } from "./OpenTodosCard";

import type { Todo } from "@/shared/ipc/IpcContract";

function todo(partial: Partial<Todo> & { id: string; text: string }): Todo {
  return {
    done: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("OpenTodosCard", () => {
  it("shows empty state when there are no open todos", () => {
    render(<OpenTodosCard todos={[]} doneThisWeek={0} onToggle={vi.fn()} onOpenAll={vi.fn()} />);
    expect(screen.getByText("All clear")).toBeInTheDocument();
    expect(screen.getByText("No open todos. Nice.")).toBeInTheDocument();
  });

  it("renders the count, weekly summary, and a preview of open todos", () => {
    const todos = [
      todo({ id: "1", text: "Write spec" }),
      todo({ id: "2", text: "Wire UI" }),
      todo({ id: "3", text: "Already done", done: true, completedAt: new Date().toISOString() }),
    ];
    render(<OpenTodosCard todos={todos} doneThisWeek={3} onToggle={vi.fn()} onOpenAll={vi.fn()} />);
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getByText("3 done this week")).toBeInTheDocument();
    expect(screen.getByText("Write spec")).toBeInTheDocument();
    expect(screen.getByText("Wire UI")).toBeInTheDocument();
    expect(screen.queryByText("Already done")).toBeNull();
  });

  it("flags stale todos older than 7 days and shows a reminder", () => {
    const oldIso = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const todos = [todo({ id: "1", text: "Stale item", createdAt: oldIso })];
    render(<OpenTodosCard todos={todos} doneThisWeek={0} onToggle={vi.fn()} onOpenAll={vi.fn()} />);
    expect(screen.getByTestId("home-todos-stale-reminder")).toHaveTextContent(
      /1 todo has been open for more than 7 days/,
    );
    expect(screen.getByText("stale")).toBeInTheDocument();
  });

  it("calls onToggle when the checkbox is clicked", () => {
    const onToggle = vi.fn();
    const todos = [todo({ id: "abc", text: "Hello" })];
    render(
      <OpenTodosCard todos={todos} doneThisWeek={0} onToggle={onToggle} onOpenAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText('Mark "Hello" as done'));
    expect(onToggle).toHaveBeenCalledWith("abc");
  });

  it("calls onOpenAll when the open button is clicked", () => {
    const onOpenAll = vi.fn();
    const todos = [todo({ id: "1", text: "x" })];
    render(
      <OpenTodosCard todos={todos} doneThisWeek={0} onToggle={vi.fn()} onOpenAll={onOpenAll} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open todos/i }));
    expect(onOpenAll).toHaveBeenCalled();
  });

  it("shows '+N more' when there are more open todos than the preview limit", () => {
    const todos = Array.from({ length: 9 }).map((_, idx) =>
      todo({ id: String(idx), text: `T${idx}` }),
    );
    render(<OpenTodosCard todos={todos} doneThisWeek={0} onToggle={vi.fn()} onOpenAll={vi.fn()} />);
    expect(screen.getByText("+3 more")).toBeInTheDocument();
  });
});
