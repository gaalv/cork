import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./Select";

describe("Select", () => {
  it("renders the selected label and opens the listbox", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="b"
        ariaLabel="Choose"
        onChange={onChange}
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "Choose" });
    expect(trigger).toHaveTextContent("Beta");
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox", { name: "Choose" })).toBeInTheDocument();
  });

  it("selects an option on click", () => {
    const onChange = vi.fn();
    render(
      <Select
        value="a"
        ariaLabel="Choose"
        onChange={onChange}
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Choose" }));
    fireEvent.click(screen.getByRole("option", { name: /Beta/ }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
