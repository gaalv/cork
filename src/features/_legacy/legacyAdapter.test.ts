import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useIndexStore } from "@/features/index/state/indexStore";
import { useVaultStore } from "@/features/vault/state/vaultStore";

import { useLegacyVaultData } from "./legacyAdapter";

describe("legacy adapter index data", () => {
  beforeEach(() => {
    useVaultStore.setState({
      path: "/vault",
      notes: [
        { id: "a", path: "/vault/a.md", title: "A", folder: "", size: 1, mtime: 1 },
        { id: "b", path: "/vault/b.md", title: "B", folder: "", size: 1, mtime: 2 },
      ],
      isLoading: false,
      error: null,
    });
    useIndexStore.setState({
      ready: true,
      recentNotes: [{ id: "b", path: "/vault/b.md", title: "B", folder: "", size: 1, mtime: 2 }],
      tags: [{ tag: "dev", count: 2 }],
      error: null,
    });
  });

  it("uses indexed recents and tags for legacy shapes", () => {
    const { result } = renderHook(() => useLegacyVaultData());

    expect(result.current.recentNotes).toEqual(["b"]);
    expect(result.current.tags).toEqual([{ id: "dev", name: "dev", count: 2 }]);
    expect(result.current.isLoading).toBe(false);
  });
});
