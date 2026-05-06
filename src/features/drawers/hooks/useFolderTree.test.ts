import { describe, expect, it } from "vitest";

import { buildFolderTree } from "./useFolderTree";

import type { NoteEntry } from "@/shared/ipc/types";

const notes: NoteEntry[] = [
  { id: "n1", path: "/vault/work/a.md", title: "A", folder: "work", size: 1, mtime: 1 },
  { id: "n2", path: "/vault/work/projects/b.md", title: "B", folder: "work/projects", size: 1, mtime: 1 },
  { id: "n3", path: "/vault/personal/c.md", title: "C", folder: "personal", size: 1, mtime: 1 },
];

describe("buildFolderTree", () => {
  it("builds nested folders with aggregate counts", () => {
    const tree = buildFolderTree(notes);

    expect(tree.map((node) => node.path)).toEqual(["personal", "work"]);
    expect(tree[1]?.count).toBe(2);
    expect(tree[1]?.children[0]?.path).toBe("work/projects");
    expect(tree[1]?.children[0]?.notes[0]?.id).toBe("n2");
  });
});
