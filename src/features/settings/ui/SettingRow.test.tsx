import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingRow } from "./SettingRow";

describe("SettingRow", () => {
  it("renders label and description", () => {
    render(<SettingRow label="Line wrap" description="Wrap long lines in the editor." scope="app" control={<button type="button">Toggle</button>} />);

    expect(screen.getByText("Line wrap")).toBeInTheDocument();
    expect(screen.getByText("Wrap long lines in the editor.")).toBeInTheDocument();
    expect(screen.getByText("App")).toBeInTheDocument();
  });
});
