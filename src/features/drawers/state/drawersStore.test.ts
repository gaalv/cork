import { beforeEach, describe, expect, it } from "vitest";

import { useDrawersStore } from "./drawersStore";

beforeEach(() => {
  window.localStorage.clear();
  useDrawersStore.setState({
    expandedFolders: new Set<string>(),
    expandedTags: new Set<string>(),
    selectedTag: null,
    searchHistory: [],
  });
});

describe("drawersStore", () => {
  it("tracks expanded folders", () => {
    useDrawersStore.getState().toggleFolder("work");

    expect(useDrawersStore.getState().expandedFolders.has("work")).toBe(true);

    useDrawersStore.getState().setFolderExpanded("work", false);

    expect(useDrawersStore.getState().expandedFolders.has("work")).toBe(false);
  });

  it("tracks selected and expanded tags", () => {
    useDrawersStore.getState().toggleTag("dev");
    useDrawersStore.getState().selectTag("dev/rust");

    expect(useDrawersStore.getState().expandedTags.has("dev")).toBe(true);
    expect(useDrawersStore.getState().selectedTag).toBe("dev/rust");
  });

  it("persists the last ten unique searches", () => {
    for (let index = 0; index < 12; index += 1) {
      useDrawersStore.getState().addSearchHistory(`query-${index}`);
    }
    useDrawersStore.getState().addSearchHistory("query-5");

    expect(useDrawersStore.getState().searchHistory).toHaveLength(10);
    expect(useDrawersStore.getState().searchHistory[0]).toBe("query-5");
    expect(JSON.parse(window.localStorage.getItem("noxe.searchHistory") ?? "[]")).toHaveLength(10);
  });
});
