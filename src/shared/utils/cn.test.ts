import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn()", () => {
  it("joins truthy class names", () => {
    const flag = false as boolean;
    expect(cn("a", flag && "b", "c")).toBe("a c");
  });

  it("merges conflicting Tailwind utilities", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles arrays and objects", () => {
    expect(cn(["a", { b: true, c: false }], "d")).toBe("a b d");
  });
});
