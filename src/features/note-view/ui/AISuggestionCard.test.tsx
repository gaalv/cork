import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AISuggestionCard } from "./AISuggestionCard";

describe("AISuggestionCard", () => {
  it("renders the coming soon stub", () => {
    render(<AISuggestionCard />);

    expect(screen.getByRole("heading", { name: "AI Suggestions" })).toBeInTheDocument();
    expect(screen.getByText(/future local-first AI/)).toBeInTheDocument();
  });
});
