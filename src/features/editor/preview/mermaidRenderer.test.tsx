import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MermaidDiagram } from "./mermaidRenderer";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg><text>flow</text></svg>" }),
  },
}));

describe("MermaidDiagram", () => {
  it("renders a flowchart fixture", async () => {
    render(<MermaidDiagram source="flowchart LR\nA-->B" />);

    await waitFor(() => expect(screen.getByTestId("mermaid-diagram").querySelector("svg")).toBeInTheDocument());
  });
});
