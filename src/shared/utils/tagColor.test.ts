// Vitest test for tagColor utility.
import { describe, expect, it } from "vitest";

import { tagHue, tagSwatch } from "./tagColor";

describe("tagColor", () => {
  it("is deterministic for the same tag", () => {
    expect(tagHue("project")).toBe(tagHue("project"));
    expect(tagSwatch("idea")).toEqual(tagSwatch("idea"));
  });

  it("differentiates distinct tags", () => {
    expect(tagHue("a")).not.toBe(tagHue("z"));
  });

  it("produces a hue in 0..359", () => {
    for (const tag of ["", "x", "noxe", "tag-with-dash", "  spaced  "]) {
      const hue = tagHue(tag);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("returns three CSS strings from the swatch helper", () => {
    const { background, foreground, border } = tagSwatch("project");
    expect(background).toMatch(/^hsl\(/);
    expect(foreground).toMatch(/^hsl\(/);
    expect(border).toMatch(/^hsl\(/);
  });
});
