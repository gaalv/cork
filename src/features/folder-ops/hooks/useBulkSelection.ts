import { useSelectionStore } from "@/features/folder-ops/state/selectionStore";

export function useBulkSelection(orderedPaths: string[]) {
  const selectedPaths = useSelectionStore((state) => state.selectedPaths);
  const anchorPath = useSelectionStore((state) => state.anchorPath);
  const setSelected = useSelectionStore((state) => state.setSelected);
  const toggleOne = useSelectionStore((state) => state.toggleOne);
  const clear = useSelectionStore((state) => state.clear);

  function handleClick(event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey">, path: string): boolean {
    if (event.shiftKey && anchorPath) {
      const start = orderedPaths.indexOf(anchorPath);
      const end = orderedPaths.indexOf(path);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        setSelected(orderedPaths.slice(from, to + 1), path);
        return true;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      toggleOne(path);
      return true;
    }
    if (selectedPaths.length > 0) {
      setSelected([path], path);
      return true;
    }
    return false;
  }

  return { selectedPaths, selectedCount: selectedPaths.length, isSelected: (path: string) => selectedPaths.includes(path), handleClick, clear };
}
