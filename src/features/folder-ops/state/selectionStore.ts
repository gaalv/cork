import { create } from "zustand";

type SelectionState = {
  selectedPaths: string[];
  anchorPath: string | null;
  setSelected: (paths: string[], anchorPath?: string | null) => void;
  toggleOne: (path: string) => void;
  clear: () => void;
};

export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedPaths: [],
  anchorPath: null,
  setSelected: (paths, anchorPath = paths.at(-1) ?? null) => set({ selectedPaths: dedupe(paths), anchorPath }),
  toggleOne: (path) => {
    const selectedPaths = get().selectedPaths;
    set({
      selectedPaths: selectedPaths.includes(path)
        ? selectedPaths.filter((selected) => selected !== path)
        : [...selectedPaths, path],
      anchorPath: path,
    });
  },
  clear: () => set({ selectedPaths: [], anchorPath: null }),
}));

function dedupe(paths: string[]): string[] {
  return paths.filter((path, index) => paths.indexOf(path) === index);
}
