import { describe, expect, it } from "vitest";

import { buildTagTree } from "./useTagTree";

describe("buildTagTree", () => {
  it("builds slash-separated tags with aggregate counts", () => {
    const tree = buildTagTree([
      { tag: "work/projects", count: 2 },
      { tag: "work/rust", count: 1 },
      { tag: "personal", count: 3 },
    ]);

    expect(tree.map((node) => node.tag)).toEqual(["personal", "work"]);
    expect(tree[1]?.count).toBe(3);
    expect(tree[1]?.children.map((node) => node.tag)).toEqual(["work/projects", "work/rust"]);
  });
});
