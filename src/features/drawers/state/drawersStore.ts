import { create } from "zustand";

const SEARCH_HISTORY_KEY = "noxe.searchHistory";
const MAX_SEARCH_HISTORY = 10;

export type DrawersStore = {
  expandedFolders: Set<string>;
  expandedTags: Set<string>;
  selectedFolder: string | null;
  selectedTag: string | null;
  searchHistory: string[];
  toggleFolder: (folder: string) => void;
  setFolderExpanded: (folder: string, expanded: boolean) => void;
  selectFolder: (folder: string | null) => void;
  toggleTag: (tag: string) => void;
  setTagExpanded: (tag: string, expanded: boolean) => void;
  selectTag: (tag: string | null) => void;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  reset: () => void;
};

export const useDrawersStore = create<DrawersStore>((set) => ({
  expandedFolders: new Set<string>(),
  expandedTags: new Set<string>(),
  selectedFolder: null,
  selectedTag: null,
  searchHistory: loadSearchHistory(),

  toggleFolder(folder) {
    set((state) => ({ expandedFolders: toggled(state.expandedFolders, folder) }));
  },

  setFolderExpanded(folder, expanded) {
    set((state) => ({ expandedFolders: withExpansion(state.expandedFolders, folder, expanded) }));
  },

  selectFolder(folder) {
    set({ selectedFolder: folder });
  },

  toggleTag(tag) {
    set((state) => ({ expandedTags: toggled(state.expandedTags, tag) }));
  },

  setTagExpanded(tag, expanded) {
    set((state) => ({ expandedTags: withExpansion(state.expandedTags, tag, expanded) }));
  },

  selectTag(tag) {
    set({ selectedTag: tag });
  },

  addSearchHistory(query) {
    const normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }
    set((state) => {
      const searchHistory = [normalized, ...state.searchHistory.filter((entry) => entry !== normalized)].slice(
        0,
        MAX_SEARCH_HISTORY,
      );
      persistSearchHistory(searchHistory);
      return { searchHistory };
    });
  },

  clearSearchHistory() {
    persistSearchHistory([]);
    set({ searchHistory: [] });
  },

  reset() {
    set({
      expandedFolders: new Set<string>(),
      expandedTags: new Set<string>(),
      selectedFolder: null,
      selectedTag: null,
      searchHistory: loadSearchHistory(),
    });
  },
}));

function toggled(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function withExpansion(values: Set<string>, value: string, expanded: boolean): Set<string> {
  const next = new Set(values);
  if (expanded) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}

function loadSearchHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, MAX_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

function persistSearchHistory(searchHistory: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.slice(0, MAX_SEARCH_HISTORY)));
}
