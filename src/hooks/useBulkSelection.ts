/**
 * Bulk selection hook — manages multi-select state for notes.
 *
 * Supports click (toggle), Shift+click (range), and Cmd+click (add).
 *
 * @see F08 — Folder Management spec
 */

import { create } from "zustand";

type BulkSelectionState = {
  selected: Set<string>;
  lastClicked: string | null;
  toggle: (path: string) => void;
  add: (path: string) => void;
  remove: (path: string) => void;
  clear: () => void;
  selectRange: (paths: string[], from: string, to: string) => void;
  isSelected: (path: string) => boolean;
  handleClick: (event: React.MouseEvent, path: string, allPaths?: string[]) => boolean;
};

const useBulkSelectionStore = create<BulkSelectionState>((set, get) => ({
  selected: new Set(),
  lastClicked: null,

  toggle: (path) =>
    set((state) => {
      const next = new Set(state.selected);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { selected: next, lastClicked: path };
    }),

  add: (path) =>
    set((state) => {
      const next = new Set(state.selected);
      next.add(path);
      return { selected: next, lastClicked: path };
    }),

  remove: (path) =>
    set((state) => {
      const next = new Set(state.selected);
      next.delete(path);
      return { selected: next };
    }),

  clear: () => set({ selected: new Set(), lastClicked: null }),

  selectRange: (paths, from, to) =>
    set((state) => {
      const fromIdx = paths.indexOf(from);
      const toIdx = paths.indexOf(to);
      if (fromIdx === -1 || toIdx === -1) return state;
      const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      const next = new Set(state.selected);
      for (let i = start; i <= end; i++) {
        next.add(paths[i]);
      }
      return { selected: next, lastClicked: to };
    }),

  isSelected: (path) => get().selected.has(path),

  handleClick: (event, path, allPaths) => {
    const { metaKey, shiftKey } = event;
    if (!metaKey && !shiftKey) return false; // let caller handle normal click

    event.preventDefault();
    if (metaKey) {
      get().toggle(path);
      return true;
    }
    if (shiftKey && allPaths && get().lastClicked) {
      get().selectRange(allPaths, get().lastClicked!, path);
      return true;
    }
    get().toggle(path);
    return true;
  },
}));

export function useBulkSelection() {
  const selected = useBulkSelectionStore((s) => s.selected);
  const toggle = useBulkSelectionStore((s) => s.toggle);
  const clear = useBulkSelectionStore((s) => s.clear);
  const isSelected = useBulkSelectionStore((s) => s.isSelected);
  const handleClick = useBulkSelectionStore((s) => s.handleClick);
  const selectRange = useBulkSelectionStore((s) => s.selectRange);

  return { selected, toggle, clear, isSelected, handleClick, selectRange };
}
