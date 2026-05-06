import { create } from "zustand";

export type NoteMetaPanelSection = "outline" | "backlinks" | "recents" | "ai";

type NoteViewStore = {
  activeNotePath: string | null;
  panelCollapsed: boolean;
  activeSection: NoteMetaPanelSection;
  scrollPositions: Record<string, number>;
  setActiveNotePath: (path: string | null) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  togglePanelCollapsed: () => void;
  setActiveSection: (section: NoteMetaPanelSection) => void;
  saveScrollPosition: (noteId: string, position: number) => void;
  getScrollPosition: (noteId: string) => number;
  reset: () => void;
};

const initialState = {
  activeNotePath: null,
  panelCollapsed: false,
  activeSection: "outline" as NoteMetaPanelSection,
  scrollPositions: {},
};

export const useNoteViewStore = create<NoteViewStore>((set, get) => ({
  ...initialState,

  setActiveNotePath(path) {
    set({ activeNotePath: path });
  },

  setPanelCollapsed(collapsed) {
    set({ panelCollapsed: collapsed });
  },

  togglePanelCollapsed() {
    set((state) => ({ panelCollapsed: !state.panelCollapsed }));
  },

  setActiveSection(section) {
    set({ activeSection: section });
  },

  saveScrollPosition(noteId, position) {
    set((state) => ({ scrollPositions: { ...state.scrollPositions, [noteId]: position } }));
  },

  getScrollPosition(noteId) {
    return get().scrollPositions[noteId] ?? 0;
  },

  reset() {
    set(initialState);
  },
}));
