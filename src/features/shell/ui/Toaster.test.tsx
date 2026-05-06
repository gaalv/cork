import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { emitIpcError } from "@/shared/ipc/errors";

import { Toaster } from "./Toaster";

describe("Toaster", () => {
  it("renders synthetic IPC errors", async () => {
    render(<Toaster />);

    act(() => {
      emitIpcError({ topic: "error.index", message: "Index failed" });
    });

    expect(await screen.findByText("Index failed")).toBeVisible();
  });
});
