import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Preview } from "@/features/editor/ui/Preview";

describe("KaTeX preview", () => {
  it("renders inline math", () => {
    render(<Preview markdown="Inline $x^2$ math" />);

    expect(screen.getByTestId("markdown-preview").querySelector(".katex")).toBeInTheDocument();
  });
});
